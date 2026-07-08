import subprocess
import time
import requests
import os

# run uvicorn
proc = subprocess.Popen(["../.venv/bin/uvicorn", "app.main:app", "--port", "8001"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd="backend", text=True)
time.sleep(2)

with open("token.txt", "r") as f:
    token = f.read().strip()

r = requests.get("http://localhost:8001/api/documents/drafts/TestUser_EMP001", headers={"Authorization": f"Bearer {token}"})
print("STATUS:", r.status_code)

proc.terminate()
stdout, _ = proc.communicate()
print("LOGS:")
print(stdout)
