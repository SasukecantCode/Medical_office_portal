use std::fs;
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;
use notify::{Watcher, RecursiveMode};

#[tauri::command]
fn edit_document(
    employee_id: String,
    draft_id: String,
    filename: String,
    download_url: String,
    upload_url: String,
    token: String,
) -> Result<(), String> {
    // Run the actual heavy lifting in a detached thread so we don't block Tauri
    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::new();
        
        // 1. Download
        println!("Downloading from {}", download_url);
        let res = match client.get(&download_url).header("Authorization", format!("Bearer {}", token)).send() {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Failed to download: {}", e);
                return;
            }
        };
        let bytes = match res.bytes() {
            Ok(b) => b,
            Err(e) => {
                eprintln!("Failed to read bytes: {}", e);
                return;
            }
        };
        
        let mut cache_dir = std::env::temp_dir();
        cache_dir.push("DMONamsai_Cache");
        cache_dir.push(&draft_id);
        let _ = fs::create_dir_all(&cache_dir);
        let file_path = cache_dir.join(&filename);
        
        if let Err(e) = fs::write(&file_path, bytes) {
            eprintln!("Failed to write file: {}", e);
            return;
        }
        
        // 2. Open file
        println!("Opening file {:?}", file_path);
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("cmd").args(["/c", "start", "", file_path.to_str().unwrap()]).spawn();
        #[cfg(target_os = "linux")]
        let _ = std::process::Command::new("xdg-open").arg(&file_path).spawn();
        #[cfg(target_os = "macos")]
        let _ = std::process::Command::new("open").arg(&file_path).spawn();
        
        // 3. Watch for changes
        let (tx, rx) = channel();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create watcher: {}", e);
                return;
            }
        };
        
        if let Err(e) = watcher.watch(&file_path, RecursiveMode::NonRecursive) {
            eprintln!("Failed to watch file: {}", e);
            return;
        }
        
        println!("Watching for changes on {:?}", file_path);
        
        let mut last_upload = std::time::Instant::now();
        
        for res in rx {
            match res {
                Ok(_event) => {
                    // Debounce simple
                    if last_upload.elapsed() > Duration::from_secs(2) {
                        // Try to read (Word might lock it temporarily)
                        // This assumes Word releases the lock when saving. If not, it will just fail to read and we try again on next event.
                        if let Ok(content) = fs::read(&file_path) {
                            println!("Uploading modified file...");
                            let req = client.put(&upload_url)
                                .header("Authorization", format!("Bearer {}", token))
                                .body(content);
                            
                            match req.send() {
                                Ok(resp) => {
                                    println!("Upload success: {}", resp.status());
                                    last_upload = std::time::Instant::now();
                                }
                                Err(e) => {
                                    eprintln!("Failed to upload: {}", e);
                                }
                            }
                        }
                    }
                },
                Err(e) => println!("watch error: {:?}", e),
            }
        }
    });
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![edit_document])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
