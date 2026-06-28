# Job outreach assistant

Local app to import contacts from a spreadsheet, tailor a resume per job post with Google AI, and send emails with a PDF attached.

Open **http://localhost:3000** after starting the dev server.

---

## Run locally

```bash
npm install
cp .env.example .env
# Edit .env (email + Google Cloud — see below)
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Optional Docker:

```bash
docker compose up --build
```

---

## Email setup (SMTP)

The app sends mail through your normal email provider using SMTP (same idea as Outlook or Thunderbird).

1. Copy `.env.example` → `.env`.
2. Fill in the **SMTP** block. Example for **Gmail**:
   - Turn on [2-Step Verification](https://myaccount.google.com/security).
   - Create an [App Password](https://myaccount.google.com/apppasswords) (not your normal Gmail password).
   - Use that app password as `SMTP_PASS`.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=you@gmail.com
EMAIL_FROM_NAME=Your Name
EMAIL_SIGNATURE_NAME=Your Name
```

3. **Practice without sending:** set `SMTP_DRY_RUN=true` — no mail is delivered; good for testing the UI.
4. Check delivery under **Try features → Outgoing email**.

Other providers (Outlook, Zoho, etc.): use their SMTP host, port, and login — same variables.

---

## Google Cloud / AI (Vertex)

Used to sort imports by role (when your CSV has no `Category` column) and to tailor resumes before send.

1. Create or pick a GCP project with **Vertex AI** enabled.
2. Create a **service account** and download its **JSON key**.
3. **Where to put the key file** (never commit it — `secrets/*.json` is gitignored):

   | How you run | Put the JSON file | Set in `.env` |
   |-------------|-------------------|---------------|
   | `npm run dev` | `secrets/your-key.json` | `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/email-automation/secrets/your-key.json` |
   | Docker Compose | `secrets/your-key.json` | `GOOGLE_APPLICATION_CREDENTIALS=/run/gcp/your-key.json` |

   On Mac/Linux, get the absolute path with:

   ```bash
   pwd   # from the repo root, then append /secrets/your-key.json
   ```

4. In `.env`:

   ```env
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GOOGLE_CLOUD_LOCATION=global
   GOOGLE_APPLICATION_CREDENTIALS=/path/as/above
   ```

5. Grant the service account **Vertex AI User** (`roles/aiplatform.user`) on the project if calls fail with permission errors.

More detail: [secrets/README.md](secrets/README.md).

Test AI under **Try features → AI & resume**.

---

## First-time app setup

1. **Settings** — upload your master resume, add your name (for PDF file names), edit email templates.
2. **Home** — choose a `.csv`, **Import & clean**, then **Send emails** (sends in batches of 5; the table refreshes after each batch).

Optional CSV column **`Category`** with values `frontend`, `fullstack`, or `other` skips AI sorting on import.

Contact data is stored locally in `.data/` (also gitignored).

---

## Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (webpack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
