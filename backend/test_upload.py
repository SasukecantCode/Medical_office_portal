import requests
import io

url = 'http://127.0.0.1:8000/api/documents/upload?employee_id=EMP052&category=Personal'
files = {'file': ('test.txt', io.BytesIO(b'test data'), 'text/plain')}
res = requests.post(url, files=files)
print(res.status_code)
print(res.text)
