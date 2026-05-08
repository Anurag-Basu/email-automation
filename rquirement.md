# 🚀 Cursor Prompt (CSV Lead Email Automation System)

Build a production-ready **Node.js full-stack automation system** that processes job leads from a CSV file, classifies them, displays them in a UI, and automates email sending with tracking.

The system must run locally and be fully Dockerized.

---

# 🧠 High-Level Goal

We are building a system that:

1. Uploads a CSV file from UI
2. Displays parsed leads in a table UI
3. Classifies each lead into:
   - Frontend
   - Fullstack

4. Sends emails one by one using a static email template
5. Tracks email status:
   - pending
   - sent
   - failed

6. Updates UI in real-time or on refresh
7. Runs fully locally via Docker

---

# ⚙️ Tech Stack

### Backend:

- Node.js (LTS)
- Express

### Frontend:

- React (simple UI dashboard)

### Others:

- multer (CSV upload)
- csv-parser (or fast-csv)
- node-cron (optional)
- Nodemailer (Gmail SMTP)
- dotenv
- Docker

---

# 📦 Core Features

## 1. CSV Upload API + Parser

**Endpoint:**
POST `/upload`

- Accept CSV file upload
- Parse CSV into objects:

```json
{
  "author": "John Doe",
  "email": "john@email.com",
  "description": "React developer"
}
```

- Store in memory or JSON file

---

## 2. Frontend UI Dashboard

React UI must:

- Upload CSV
- Show table:
  - Author
  - Email
  - Description
  - Category
  - Status

- Button: “Send Emails”

---

## 3. Classification Engine

Rules:

- Frontend: React, Angular, HTML, CSS
- Fullstack: Node, backend, API

Store:

```json
{
  "category": "frontend | fullstack"
}
```

---

## 4. Email Automation

**Endpoint:**
POST `/send-emails`

Flow:

- Fetch pending leads
- Send email one by one (sequential)
- Use static template

---

## 5. Email Template

Subject:

```
Opportunity for {{role}} role
```

Body:

```
Hi {{name}},

I came across your profile regarding {{role}} opportunities.

Please find my resume attached.

Best regards,
[Your Name]
```

---

## 6. Status Tracking

- success → sent
- failure → failed

Update immediately in store

---

## 7. Storage

No DB.
Use:

- in-memory array OR
- JSON file

Structure:

```json
{
  "id": 1,
  "author": "John",
  "email": "john@email.com",
  "description": "React dev",
  "category": "frontend",
  "status": "pending"
}
```

---

## 8. Project Structure

```
src/
  api/
  services/
  data/
  index.js

frontend/
  src/
    components/
    App.js

Dockerfile
docker-compose.yml
```

---

## 9. Workflow

### Step 1

CSV upload → parse → classify → store

### Step 2

UI renders table

### Step 3

Click send emails → process sequentially → update status

---

## 🐳 Docker Requirement (SEPARATED - OPTIONAL)

Docker is NOT required for local development.
It is only for later packaging and sharing.

### You should NOT depend on Docker for running the app locally.

---

## 📦 Docker Setup (Optional / Future Use)

Provide Docker files, but keep them separate from core dev workflow:

### Dockerfile

- Backend container only
- Frontend container optional

### docker-compose.yml

- Optional orchestration for full stack

---

## 🧪 Package.json Scripts (IMPORTANT)

Add scripts to easily build and prepare Docker image later:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",

  "docker:build": "docker build -t lead-automation-app .",
  "docker:run": "docker run -p 3000:3000 lead-automation-app",
  "docker:compose": "docker-compose up --build"
}
```

### Key Points:

- Docker is optional
- Local run should NOT require Docker
- Scripts should allow easy Docker image creation when needed

---

## 🚨 Constraints

- No Google Sheets
- No n8n/Zapier
- Fully local system
- Sequential email sending
- Simple architecture

---

## 🎯 Output

Generate complete working system with:

- backend API
- frontend UI
- email automation
- classification engine
- Docker setup
- clean modular code
