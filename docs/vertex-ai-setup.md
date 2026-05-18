# Vertex AI (GCP) — minimal setup

## 1. Project and billing

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or **create a project**.
2. Link a **billing account** to that project (Vertex AI requires billing).

## 2. Enable the API

The top search bar favors docs and product pages. Enable the API from the **Library** (or use the link below).

1. Go to **APIs & Services → Library** (not the global search-only flow).
2. In the Library search box, type **`Vertex AI`** (spelling: **vertex**, not “vertext”) or paste the product id **`aiplatform.googleapis.com`**.
3. Open **Vertex AI API** and click **Enable**.

Direct link (pick your project in the console first):  
https://console.cloud.google.com/apis/library/aiplatform.googleapis.com

If you are on **Vertex AI / Agent Platform** and see **Enable APIs**, that flow also turns on what the console needs for that product.

## 3. Service account (for app / server access)

1. Go to **IAM & Admin → Service Accounts → Create service account**.
2. Grant role **Vertex AI User** (`roles/aiplatform.user`).
3. **Keys → Add key → JSON** and download the file (use only in secure environments; do not commit it).
4. Under **IAM & Admin → IAM**, confirm that account is listed on the project with that role.

## 4. Local authentication

Pick one:

- **Service account:** set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of the JSON key.
- **User ADC (dev only):** install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), run `gcloud auth application-default login`, and set `GOOGLE_CLOUD_PROJECT` to your project ID.

## 5. Values your app needs

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | Often **`global`** for Gemini Enterprise / Agent Platform; some orgs use a region — must match where your model is published |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account JSON (if not using ADC) |

If requests return quota errors, use **IAM & Admin → Quotas** (filter by Vertex AI) and adjust or request increases.

## 6. This repo

- Env: copy the Vertex block from `.env.example` into `.env` / `.env.local`.
- Code: `lib/vertex-genai.ts` uses `@google/genai` with `enterprise: true` (Gemini Enterprise / Agent Platform path in the SDK).
- Smoke test: open `/test` → **Test Vertex**, or `POST /api/test-vertex` with JSON `{ "prompt": "..." }`.
- If **404 / model not found** on `generateContent`, set **`GOOGLE_CLOUD_LOCATION=global`** and use an Agent Platform model id (defaults in code to **`gemini-2.5-flash`**), or set **`VERTEX_GEMINI_MODEL`** to a model your project can access — see [Gemini Enterprise models](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start).
- If you get **403**, ensure the service account has **Vertex AI User** (`roles/aiplatform.user`) if Agent-only roles are insufficient.

### Docker Desktop (this repo)

- Service account: `email-automation@project-40bf9d6a-3b6c-4ff3-870.iam.gserviceaccount.com`
- Download a **JSON key** from GCP into **`secrets/`** (any `*.json` name; see `secrets/README.md`). All `secrets/*.json` files are gitignored.
- `docker-compose.yml` mounts **`./secrets` → `/run/gcp`**. In `.env` set **`GOOGLE_APPLICATION_CREDENTIALS=/run/gcp/<same-filename>.json`** (path inside the container).