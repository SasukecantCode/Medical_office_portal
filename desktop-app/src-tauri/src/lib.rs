use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use notify::{Watcher, RecursiveMode};
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
struct UploadEvent {
    draft_id: String,
    version: i64,
}

#[derive(Clone, Serialize)]
struct ConflictEvent {
    draft_id: String,
    message: String,
}

#[derive(Deserialize)]
struct PutResponse {
    status: String,
    version: i64,
}

fn get_sessions() -> &'static Mutex<HashMap<String, std::sync::mpsc::Sender<()>>> {
    static SESSIONS: OnceLock<Mutex<HashMap<String, std::sync::mpsc::Sender<()>>>> = OnceLock::new();
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
fn edit_document(
    app: AppHandle,
    employee_id: String,
    draft_id: String,
    filename: String,
    download_url: String,
    upload_url: String,
    token: String,
    mut expected_version: i64,
) -> Result<(), String> {
    let (stop_tx, stop_rx) = channel();
    get_sessions().lock().unwrap().insert(draft_id.clone(), stop_tx);

    let draft_id_clone = draft_id.clone();
    
    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::new();
        
        let res = match client.get(&download_url).header("Authorization", format!("Bearer {}", token)).send() {
            Ok(r) => r,
            Err(e) => { eprintln!("Failed to download: {}", e); return; }
        };
        let bytes = match res.bytes() {
            Ok(b) => b,
            Err(e) => { eprintln!("Failed to read bytes: {}", e); return; }
        };
        
        let mut cache_dir = std::env::temp_dir();
        cache_dir.push("DMONamsai_Cache");
        cache_dir.push(&draft_id_clone);
        let _ = fs::create_dir_all(&cache_dir);
        let file_path = cache_dir.join(&filename);
        
        if let Err(e) = fs::write(&file_path, bytes) {
            eprintln!("Failed to write file: {}", e);
            return;
        }
        
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("cmd").args(["/c", "start", "", file_path.to_str().unwrap()]).spawn();
        #[cfg(target_os = "linux")]
        let _ = std::process::Command::new("xdg-open").arg(&file_path).spawn();
        #[cfg(target_os = "macos")]
        let _ = std::process::Command::new("open").arg(&file_path).spawn();
        
        let (tx, rx) = channel();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => { eprintln!("Failed to create watcher: {}", e); return; }
        };
        
        // Watch the DIRECTORY so we catch renames of temp files back to target file
        if let Err(e) = watcher.watch(&cache_dir, RecursiveMode::NonRecursive) {
            eprintln!("Failed to watch directory: {}", e);
            return;
        }
        
        let mut last_upload = std::time::Instant::now();
        
        loop {
            // Check for stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(Ok(event)) => {
                    let mut relevant = false;
                    for p in event.paths {
                        // Ignore ~$ lock files
                        if let Some(fname) = p.file_name() {
                            if fname.to_string_lossy().starts_with("~$") {
                                continue;
                            }
                        }
                        
                        if p == file_path {
                            relevant = true;
                            break;
                        }
                    }
                    if relevant && last_upload.elapsed() > Duration::from_secs(2) {
                        // Sleep briefly to let Word release lock after saving
                        std::thread::sleep(Duration::from_millis(500));
                        
                        if let Ok(content) = fs::read(&file_path) {
                            let url_with_version = format!("{}?expected_version={}", upload_url, expected_version);
                            let req = client.put(&url_with_version)
                                .header("Authorization", format!("Bearer {}", token))
                                .body(content);
                            
                            match req.send() {
                                Ok(resp) => {
                                    if resp.status().as_u16() == 409 {
                                        let _ = app.emit("conflict", ConflictEvent {
                                            draft_id: draft_id_clone.clone(),
                                            message: "Document edited elsewhere. Conflict detected!".into(),
                                        });
                                        break; // End session on conflict
                                    } else if resp.status().is_success() {
                                        if let Ok(json) = resp.json::<PutResponse>() {
                                            expected_version = json.version;
                                            let _ = app.emit("upload-complete", UploadEvent {
                                                draft_id: draft_id_clone.clone(),
                                                version: expected_version,
                                            });
                                        }
                                        last_upload = std::time::Instant::now();
                                    }
                                }
                                Err(e) => eprintln!("Failed to upload: {}", e),
                            }
                        }
                    }
                },
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => { continue; },
                _ => { continue; }
            }
        }
        
        // Cleanup phase
        println!("Cleaning up cache for {}", draft_id_clone);
        if let Err(e) = fs::remove_dir_all(&cache_dir) {
            eprintln!("Failed to remove cache dir (may be locked by Word): {}", e);
        }
        
        get_sessions().lock().unwrap().remove(&draft_id_clone);
        let _ = app.emit("edit-session-ended", draft_id_clone);
    });
    
    Ok(())
}

#[tauri::command]
fn end_edit_session(draft_id: String) -> Result<(), String> {
    if let Some(sender) = get_sessions().lock().unwrap().remove(&draft_id) {
        let _ = sender.send(());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![edit_document, end_edit_session])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
