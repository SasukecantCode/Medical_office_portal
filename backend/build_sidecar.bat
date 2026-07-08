@echo off
echo Installing PyInstaller...
pip install pyinstaller

echo Building Backend Executable...
pyinstaller --name medical-backend --onefile run_server.py --add-data ".env;." --add-data "..\credentials\gcs-key.json;." --add-data "alembic.ini;." --add-data "alembic;alembic"

echo Creating binaries folder for Tauri...
mkdir ..\desktop-app\src-tauri\binaries 2>nul

echo Copying Sidecar to Tauri...
REM Note: The filename must end with -x86_64-pc-windows-msvc.exe for Tauri to recognize it as a sidecar
copy dist\medical-backend.exe ..\desktop-app\src-tauri\binaries\medical-backend-x86_64-pc-windows-msvc.exe

echo Done! The backend sidecar is ready. Now you can run 'npm run tauri build' in the desktop-app folder!
pause
