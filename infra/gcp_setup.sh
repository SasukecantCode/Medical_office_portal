#!/bin/bash
# DMO Namsai Portal: GCP Infrastructure Setup Script
# This script provisions the GCS bucket, enables versioning, configures lifecycle rules,
# and sets up a scoped service account for the backend API.

set -e

# Default variables (Override these with your actual values)
PROJECT_ID=${GCP_PROJECT_ID:-"dmo-namsai-portal-prod"}
BUCKET_NAME=${GCS_BUCKET_NAME:-"dmo-namsai-hr-documents"}
SERVICE_ACCOUNT_NAME="dmo-backend-api"
REGION="asia-south1"

echo "Setting GCP project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

echo "1. Creating GCS Bucket ($BUCKET_NAME) in $REGION..."
if ! gsutil ls -b gs://$BUCKET_NAME > /dev/null 2>&1; then
    gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME
else
    echo "Bucket already exists. Skipping creation."
fi

echo "2. Enabling Object Versioning..."
gsutil versioning set on gs://$BUCKET_NAME

echo "3. Applying Lifecycle Rule (Clean up temp/draft files after 3 days)..."
cat <<EOF > lifecycle.json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "age": 3,
        "matchesPrefix": [".drafts/"]
      }
    }
  ]
}
EOF
gsutil lifecycle set lifecycle.json gs://$BUCKET_NAME
rm lifecycle.json

echo "4. Creating Service Account for Backend API..."
if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com > /dev/null 2>&1; then
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --description="Service account for DMO Namsai Backend API" \
        --display-name="DMO Backend API"
else
    echo "Service account already exists. Skipping creation."
fi

echo "5. Granting GCS Object Admin role to the Service Account (Scoped to Bucket only)..."
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com:objectAdmin gs://$BUCKET_NAME

echo "6. Generating Service Account Key (for local dev / Cloud Run inject)..."
# In production on Cloud Run, you don't need a key file (it uses the attached service account automatically).
# This key is mainly for local development.
EXISTING_KEYS=$(gcloud iam service-accounts keys list --iam-account=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com --managed-by=user --format="value(name)" 2>/dev/null || true)
if [ -z "$EXISTING_KEYS" ]; then
    gcloud iam service-accounts keys create credentials.json \
        --iam-account=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com
else
    echo "A user-managed key already exists for this service account. Skipping key creation to prevent sprawl."
    echo "If you need a new key, delete the old one first via gcloud or the Cloud Console."
fi

echo ""
echo "Setup Complete!"
echo "Keep 'credentials.json' secure and never commit it to source control."
echo "Provide its absolute path in the GOOGLE_APPLICATION_CREDENTIALS environment variable for the backend API."
