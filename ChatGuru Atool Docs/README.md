# ChatGuru Atool — Add & Import Chats (Docs Bundle)

This bundle contains everything you need to brief an AI code generator (e.g., Claude) and your team about the desired Next.js app.

## Files
- `Prompt_for_CloudCode.md` — The exact prompt to paste into your code generator.
- `Supabase_Schema.sql` — SQL schema (tables, indexes, RLS).
- `API_Routes_Spec.md` — Endpoints and TypeScript handler stubs/specs.
- `Failure_XLSX_Spec.md` — Columns for the failures export.
- `UX_Wireframe.md` — UI structure and copy notes (black & white, icon-only sidebar).
- `template/add-chats-template.xlsx` — The XLSX template your users will download and fill.
- `.env.example` — Env vars to configure Supabase and cron jobs.
- `Healthcheck.md` — Simple /health endpoint behavior.

## Key Rules
- Form-encoded requests to ChatGuru (`application/x-www-form-urlencoded`).
- Required fields: `key`, `account_id`, `phone_id`, `chat_number` in every call.
- `chat_add` with optional `user_id`, `dialog_id`, and **optional `text`** (send `" "` when empty).
- Strict rate: **1 request per 10 seconds per workspace**; target ≈ **60 per 10 minutes**.
- No credentials in DB. Use localStorage and a `workspace_hash` to partition data with RLS.
- Auto-cleanup after **30 days**.