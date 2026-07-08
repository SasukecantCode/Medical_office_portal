import uvicorn
import os
import sys

# Ensure the app can find the `.env` file and modules even when compiled
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle (PyInstaller)
    bundle_dir = sys._MEIPASS
    os.chdir(bundle_dir)
else:
    # If run normally
    pass

from app.main import app

if __name__ == '__main__':
    # Run the server on localhost:8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
