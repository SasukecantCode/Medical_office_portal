import os
from google.cloud import storage

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/home/claude/Projects/Medical_office_portal/credentials/gcs-key.json'
client = storage.Client()
bucket = client.bucket('medical-office-hr-documents')

mappings = {
    'EMP052': 'Jyotiman_EMP052',
    'EMP042': 'Rajiv_Singha_EMP042',
    'EMP044': 'Photo_Ok_EMP044',
    'EMP001': 'Test_Staff_EMP001'
}

blobs = list(bucket.list_blobs())
for blob in blobs:
    for old_prefix, new_prefix in mappings.items():
        if blob.name.startswith(old_prefix + '/'):
            new_name = blob.name.replace(old_prefix + '/', new_prefix + '/', 1)
            print(f"Renaming {blob.name} to {new_name}")
            bucket.rename_blob(blob, new_name)
