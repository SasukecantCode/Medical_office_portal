import requests

r = requests.get('http://127.0.0.1:8000/api/hr/staff?limit=50')
if r.status_code == 200:
    staff = r.json()
    if len(staff) > 0:
        emp_id = f"EMP{str(staff[0]['id']).zfill(3)}"
        print(f"EMP ID: {emp_id}")
        
        # Create draft
        r2 = requests.post('http://127.0.0.1:8000/api/documents/drafts/create', json={"employee_id": emp_id, "title": "Test"})
        if r2.status_code == 200:
            draft_id = r2.json()['draft_id']
            print(f"Draft ID: {draft_id}")
            
            # Get config
            r3 = requests.get(f'http://127.0.0.1:8000/api/documents/drafts/{emp_id}/{draft_id}/onlyoffice-config')
            if r3.status_code == 200:
                config = r3.json()
                source_url = config['editor_config']['document']['url']
                print(f"Source URL: {source_url}")
                
                # Try downloading it
                r4 = requests.get(source_url)
                print(f"Download status: {r4.status_code}")
                print(f"Content length: {len(r4.content)}")
            else:
                print("Failed to get config", r3.text)
        else:
            print("Failed to create draft", r2.text)
