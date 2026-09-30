# Deploying the API to Google Cloud Run

The Express API (`server/`) runs on Cloud Run from the `Dockerfile` in the repository root.
The front end stays on Vercel and the database on MongoDB Atlas.

## 1. Create the service (one time)

1. In the Google Cloud console, open **Cloud Run** → **Deploy container** → **Service**.
2. Choose **Continuously deploy from a repository** → **Set up with Cloud Build**.
   - Enable the APIs it asks for (Cloud Build, Artifact Registry).
   - Provider **GitHub** → sign in → repository **omikhan4901/cse299**.
   - Branch: `^main$` (or the branch you deploy from).
   - Build type: **Dockerfile**, source location `/Dockerfile`.
3. Service settings:
   - Name: `resumex-api`. Region: close to your users, e.g. `asia-south1` (Mumbai) or `asia-southeast1` (Singapore).
   - Authentication: **Allow public access** (browsers call the API directly).
   - Billing: **Request-based**. Minimum instances **0** (free; ~1–3 s wake-up) or **1** (no wake-up, a few dollars a month). Maximum instances **1** for now (the per-minute rate limits are kept in memory).
4. **Container(s) → Settings**: port `8080`, memory `512 MiB`, CPU `1`, request timeout `300` seconds.
5. **Variables & secrets** (see `server/.env.example` for all options):

   | Name | Value |
   | --- | --- |
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | a new random value: `openssl rand -hex 32` |
   | `GEMINI_API_KEY` | your Gemini key |
   | `CLIENT_ORIGIN` | your site, e.g. `https://resumex.vercel.app` |
   | `TRUST_PROXY` | `1` |
   | `SUPERADMIN_EMAILS` | your email |
   | `ENCRYPTION_KEY` | `openssl rand -hex 32` (never change it afterwards) |
   | `INTERNAL_API_KEY` | `openssl rand -hex 32`; set the same value on Vercel as `INTERNAL_API_KEY` |
   | `SMTP_URL`, `MAIL_FROM`, `APP_URL` | when email is set up |

   For extra safety, store `MONGO_URI`, `JWT_SECRET` and `GEMINI_API_KEY` in **Secret Manager** and choose "Reference a secret".

   **AI through Vertex AI instead** (billed to this Google Cloud project, so Cloud credits apply;
   no API key needed): enable the Vertex AI API, give the service's account the
   **Vertex AI User** role (`roles/aiplatform.user`, labelled "Agent Platform User" in newer
   consoles), make sure billing is enabled on the project, then set:

   | Name | Value |
   | --- | --- |
   | `AI_PROVIDER` | `vertex` (remove it, or set `studio`, to go back to `GEMINI_API_KEY`) |
   | `VERTEX_PROJECT` | the project id, e.g. `resumex-509921` |
   | `VERTEX_LOCATION` | `global` (or a region) |
   | `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | model ids that Vertex offers (see Model Garden) |
6. **Create**. The first build takes a few minutes. When it finishes, open `https://<service-url>/api/health`; it should show `"db":true`.

### Reminder emails (V2)

Deadline and interview reminders and the weekly digest are sent by a scheduled call to the
API. Once email (`SMTP_URL`, `MAIL_FROM`, `APP_URL`) and `INTERNAL_API_KEY` are set:

1. **Cloud Scheduler → Create job** named `resumex-reminders`, frequency `0 */3 * * *`
   (every 3 hours), time zone `Asia/Dhaka`. Target **HTTP**, method **POST**, URL
   `https://<service-url>/api/internal/reminders`, header `X-Internal-Key: <INTERNAL_API_KEY>`,
   header `Content-Type: application/json`, body `{}`.
2. A second job `resumex-digest`, frequency `0 9 * * 1` (Mondays 9:00), same target, body
   `{"digest": true}`.

The same call also tidies accounts whose campaign (or an admin's timed grant) has ended:
they go back to their own plan and the campaign's credits and switches are removed, so it
should run even before email is set up. Nothing is sent twice, so extra runs are harmless. Each email has an unsubscribe link, and
people can turn either kind off in Account settings.

## 2. Connect the rest

- **MongoDB Atlas → Network Access → Add IP address → `0.0.0.0/0`** (Cloud Run has no fixed IP).
- **Vercel → Project → Settings → Environment Variables**: `NEXT_PUBLIC_API_URL` = `https://<service-url>/api` and `NEXT_PUBLIC_AI_ENABLED` = `true`, then redeploy.
- **Billing → Budgets & alerts**: add a small budget (e.g. $5) with email alerts.
- Once everything works, delete the old Render service.

Every push to the chosen branch now rebuilds and redeploys the API automatically.

## Deploying from the command line instead

From the repository root, in Cloud Shell or with the gcloud CLI:

```bash
gcloud run deploy resumex-api --source . --region asia-south1 \
  --allow-unauthenticated --max-instances 2 --memory 1Gi --concurrency 80 --port 8080 --timeout 300 \
  --set-env-vars TRUST_PROXY=1,CLIENT_ORIGIN=https://resumex.vercel.app \
  --set-env-vars MONGO_URI='…',JWT_SECRET='…',GEMINI_API_KEY='…'
```

## Instances and memory (beta)

The beta runs on at most **2 instances with 1 GiB each**: the limits that matter (sign-up,
login, password reset, codes, AI bursts) are counted in the database, so they hold across
both, and PDFs and Word files are read in two worker threads of up to 160 MB each.

In the console: **Cloud Run → resumex-api → Edit & deploy new revision → Container(s)**:
Memory **1 GiB**, CPU **1**; **Revision scaling**: Maximum number of instances **2**; then
**Deploy**. A redeploy from the trigger keeps these settings.

