# Prompt for Cloud Code — Next.js “atool” for ChatGuru (Add & Import Chats)

**Title:** Generate a minimal black-and-white Next.js “atool” to batch **Add Chats** in ChatGuru

**Goal:**  
Build a very simple integration tool to batch-register chats in ChatGuru using its **v1 API**. Users upload an **XLSX** file; the app sends `action=chat_add` requests (form-urlencoded), then checks `chat_add_status`. Hard rules: **rate limit = 1 request per minute per workspace** (no user choice) and effective throughput ≈ **10 adds per 10 minutes**. UI must be **black & white** only, with an **icon-only left sidebar** (like ChatGPT) to host this and future atools.

---

## Tech & Libraries
- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui** (strict monochrome; no colors)
- **lucide-react** icons (sidebar is icons-only)
- **exceljs** for reading/creating `.xlsx`
- **Supabase** (Postgres + Realtime + RLS)
- **Vercel Cron**: runs every minute to process the queue
- Optional local dev mock via `MOCK_CHATGURU=true`

---

## Product Rules
1. **Credentials & Endpoint (entered by user at runtime)**
   - Inputs: `server` (e.g., `s10`), `key`, `account_id`, `phone_id`.
   - Base endpoint: `https://{server}.chatguru.app/api/v1`
   - All requests: **`application/x-www-form-urlencoded`**.
   - **Never** store raw creds in DB. Keep only in **localStorage**; send with each server call.

2. **XLSX Template (download from UI)**
   - Columns (in this order):  
     - `chat_number` *(required, string)* — full international number  
     - `name` *(required, string)*  
     - `text` *(optional, string)* — if blank/omitted, send a **single space `" "`**  
     - `user_id` *(optional, string)*  
     - `dialog_id` *(optional, string)*
   - Preserve numbers as strings (no scientific notation / no trimming).

3. **Fixed Cadence & Rate Limit**
   - Global rule: **1 request per minute per workspace** (hard cap).
   - The tool aims for ~**10 adds per 10 minutes** (no user configuration).
   - Status checks are **throttled** to respect the same cap; implementation **prioritizes adds** and schedules status checks with some delay (a few minutes of lag is acceptable).

4. **Per-row Flow**
   - **Step A — `chat_add`**  
     Send fields: `action=chat_add`, `name`, `text` (or `" "` if empty), optional `user_id`, optional `dialog_id`, plus `key`, `account_id`, `phone_id`, `chat_number`.  
     On success, store `chat_add_id` and set item to `waiting_status`.
   - **Step B — `chat_add_status`**  
     Send fields: `action=chat_add_status`, `chat_add_id`, plus shared auth fields.  
     When response is `done`, mark item `done`. If still pending, keep waiting. If error, mark `error` and store API `code/description`.
   - **Do NOT call `dialog_execute`** after creation; ChatGuru handles dialog on add when applicable.

5. **Errors & Exports**
   - For each row, persist API outcome (`code`, `description`, `chat_add_id` if any).
   - Provide **Download Failures (.xlsx)** with original columns + `error_code`, `error_message`, `chat_add_id`.

6. **Workspace Identity (no secrets in DB)**
   - Browser computes `workspace_hash = sha256(server + key + account_id + phone_id)`.
   - Every API call includes `workspace_hash` header.  
   - Server verifies and sets Postgres setting `app.workspace_hash` for **RLS**.  
   - Users on another machine can re-enter the **same creds** to see the same jobs in realtime.

7. **Retention**
   - Auto-delete jobs/items/logs **30 days** after completion.

---

## Database (Supabase SQL)
See `Supabase_Schema.sql` in this bundle.

---

## API Routes (Next.js `/app/api`)
Implement the following routes (stubs in `API_Routes_Spec.md`):

- `POST /api/template.xlsx`  
  Generate `.xlsx` with header: `chat_number, name, text, user_id, dialog_id` + one example row (`text` example can be empty).
- `POST /api/uploads`  
  Body: file (XLSX) + `workspace_hash`. Parse with **exceljs**, validate columns, create `workspaces` (upsert), `uploads`, `upload_items`. If `text` empty/null, store as `null` (the worker will coerce to `" "` on send).
- `GET /api/uploads/:id`  
  Return upload summary + counts + recent items.
- `POST /api/uploads/:id/retry-failed`  
  Reset failed items: `state='queued'`, `attempts=0`, clear error fields.
- `GET /api/uploads/:id/failures.xlsx`  
  Stream an XLSX of failed rows (original columns + `error_code`, `error_message`, `chat_add_id`).
- `POST /api/jobs/tick`  **(Vercel Cron every minute)**  
  For each `workspace_hash` with active uploads:
  1) Enforce **1 request/min per workspace** using a lightweight lock (e.g., `workspaces.last_outbound_at` or advisory lock).  
  2) Priority: pick one `upload_items` in `queued` → perform **`chat_add`**.  
     - If `text` is null/empty, send `text=" "` (single space).  
     - On success: save `chat_add_id`, set `state='waiting_status'`.  
     - On failure: `state='error'` with `last_error_code/message`.  
  3) On alternating minutes (or when no `queued` items exist), pick the oldest `waiting_status` item → call **`chat_add_status`**.  
     - If `done`: `state='done'`. If still pending: keep state. If error: `state='error'`.  
  4) Update upload counters; when all items terminal (`done|error`), set upload `status='completed'` and `completed_at=now()`.
  5) Backoff: on 429/5xx, mark error; don’t auto-retry (user can **Retry failed**).

- `POST /api/cleanup/daily` (daily cron)  
  Hard-delete uploads/items/logs with `completed_at < now() - 30 days`.

---

## ChatGuru API (implement exactly)
- Shared required fields in every call: `key`, `account_id`, `phone_id`, `chat_number`.
- **Add chat** (`POST {base}/api/v1`, form-urlencoded):  
  - `action=chat_add`, `name`, `text` (can be a single space `" "` if user wants no initial message), optional `user_id`, optional `dialog_id`, plus shared auth.  
  - Success includes: `code`, `result`, `description`, `chat_add_id`, `chat_add_status='pending'`.
- **Check add status**:  
  - `action=chat_add_status`, `chat_add_id`, plus shared auth.  
  - When `done`, read `chat_add_status_description` for UI.

Surface API `code` and `description` in the UI per item.

---

## UI & UX (black & white only)
- **Left icon-only sidebar** (like ChatGPT): monochrome logo at top; vertical stack of circular icon buttons. First icon = **Add/Import Chats** (active). Others = disabled placeholders for future atools.
- **Page: /tools/add-chats**
  - **Credentials card**: inputs for `server`, `key`, `account_id`, `phone_id` + toggle “Remember in this browser” (writes/reads from localStorage).
  - Buttons: **Download XLSX template**, **Upload XLSX**.
  - **Jobs table** (Realtime): id, created, totals (queued/processing/succeeded/failed), status, last activity; actions: **View**, **Download failures**.
- **Page: /tools/add-chats/[uploadId]**
  - Live progress bar, counters, realtime items list (virtualized).
  - Each row shows: `row_index`, `chat_number`, `name`, current state, last message/code.
  - **Retry failed** button.

Copy in PT-BR (concise). Show helper note: “Processamento: **1 por minuto** (~10 a cada 10 min).”

---

## Implementation Notes
- Don’t store or log credentials. API routes receive creds from the browser per request, use them, and discard immediately.
- Compute `workspace_hash` client-side; include it in headers; server sets `app.workspace_hash` before DB.
- `exceljs` parsing must treat all cells as strings; trim whitespace except when sending `text`: if empty → coerce to `" "`.
- Add `/health` returning `{ ok: true }`.
- Provide `.env.example` with Supabase + Vercel cron variables.