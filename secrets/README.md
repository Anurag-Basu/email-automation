# GCP credentials (Docker)

**Service account (this project):**  
`email-automation@project-40bf9d6a-3b6c-4ff3-870.iam.gserviceaccount.com`

## What to put here

1. In [Google Cloud Console → IAM → Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts), open that account (or create it in project `project-40bf9d6a-3b6c-4ff3-870`).
2. **Keys → Add key → JSON** and download the file into this **`secrets/`** folder (any name ending in `.json`, e.g. `project-40bf9d6a-3b6c-4ff3-870-xxxx.json`).

`docker-compose.yml` mounts **`./secrets` → `/run/gcp`** in the container. In `.env` set:

`GOOGLE_APPLICATION_CREDENTIALS=/run/gcp/<your-file-name>.json`

Example: if the file on your Mac is `secrets/project-40bf9d6a-3b6c-4ff3-870-217bef7ea896.json`, use:

`GOOGLE_APPLICATION_CREDENTIALS=/run/gcp/project-40bf9d6a-3b6c-4ff3-870-217bef7ea896.json`

Then run **`docker compose up --build`** and test **Vertex** from `/test` or **CSV import** from the dashboard.

If Vertex returns permission errors, grant **Vertex AI User** (`roles/aiplatform.user`) on the project for this service account.

## Permissions on the key file

So the container user (`nextjs`, uid 1001) can read the bind-mounted file on Docker Desktop:

`chmod 644 secrets/<your-key>.json`
