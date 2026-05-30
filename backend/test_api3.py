import urllib.request
from urllib.error import HTTPError
try:
    url = "http://127.0.0.1:8000/api/documents/download?employee_id=Jyotiman_EMP052&file_path=Personal/AADHAR.png"
    res = urllib.request.urlopen(url)
    print("Success:", len(res.read()), res.getcode())
except HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("Exception:", e)
