import requests
import json
from pprint import pprint

# Let's hit the endpoint to see if creating a draft works
login_r = requests.post("http://127.0.0.1:8000/api/auth/login",
                       json={"login": "roshan", "role": "master", "password": "1234"})
auth_token = login_r.json()["access_token"]
headers = {"Authorization": f"Bearer {auth_token}"}

dr = requests.post("http://127.0.0.1:8000/api/documents/drafts/create",
                   json={"employee_id": "EMP053", "title": "TestCreation"},
                   headers=headers)
print(f"Create draft: {dr.status_code}")
if dr.status_code != 200:
    print(dr.text)
else:
    draft_id = dr.json()["draft_id"]
    cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config",
                     headers=headers)
    print(f"Config: {cr.status_code}")
    if cr.status_code != 200:
        print(cr.text)
