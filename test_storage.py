from google.cloud import storage

client = storage.Client()

bucket = client.bucket("medical-office-hr-documents")

blob = bucket.blob("test.txt")
blob.upload_from_string("Hello HR Portal!")

print("Success!")