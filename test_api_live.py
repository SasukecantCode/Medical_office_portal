import urllib.request
import json

def go():
    login_data = json.dumps({"login": "master", "role": "master", "password": "password"}).encode('utf-8')
    req = urllib.request.Request("http://localhost:8000/api/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req)
        body = json.loads(resp.read())
        token = body['access_token']
        print("Login OK")
    except urllib.error.HTTPError as e:
        print("Login failed:", e.read())
        return

    req = urllib.request.Request("http://localhost:8000/api/documents/drafts/TestUser_EMP001", headers={'Authorization': f'Bearer {token}'})
    try:
        resp = urllib.request.urlopen(req)
        print("List OK:", resp.read())
    except urllib.error.HTTPError as e:
        print("List failed:", e.status, e.read())

    # create
    create_data = json.dumps({"employee_id": "TestUser_EMP001", "title": "Test API Title"}).encode('utf-8')
    req = urllib.request.Request("http://localhost:8000/api/documents/drafts/create", data=create_data, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req)
        print("Create OK:", resp.read())
    except urllib.error.HTTPError as e:
        print("Create failed:", e.status, e.read())

go()
