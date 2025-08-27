# API Routes Spec (Next.js App Router)

> All handlers receive credentials from the browser on demand and must **not** log or persist them.

## Shared helpers (pseudo-TS)
```ts
// utils/form.ts
export function toFormUrlEncoded(body: Record<string,string>) {
  return new URLSearchParams(body).toString();
}

// utils/hash.ts (runs in browser too)
export async function workspaceHash(server: string, key: string, accountId: string, phoneId: string) {
  const data = new TextEncoder().encode(`${server}${key}${accountId}${phoneId}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```

## POST /api/template.xlsx
- Generates an XLSX with headers: `chat_number, name, text, user_id, dialog_id` + one example row.
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## POST /api/uploads
- Multipart form with `file` (XLSX) and `workspace_hash` (header or field).
- Parse using `exceljs`; validate required columns; insert records into `workspaces`, `uploads`, and `upload_items`.

## GET /api/uploads/:id
- Return upload row + aggregated counts + a page of recent items.

## POST /api/uploads/:id/retry-failed
- Set failed items back to `queued`; clear errors.

## GET /api/uploads/:id/failures.xlsx
- Export failed rows with columns: original input columns + `error_code`, `error_message`, `chat_add_id`.

## POST /api/jobs/tick  (Vercel Cron every minute)
- For each workspace with active uploads:
  - Enforce **1 request/min per workspace** (update `workspaces.last_outbound_at` atomically).
  - Prefer `queued` item → call **chat_add**:
    - If item.text is empty/null, send `" "`.
    - On success: store `chat_add_id`, state=`waiting_status`.
    - On error: state=`error`, persist `code/description`.
  - Else, pick oldest `waiting_status` → call **chat_add_status**:
    - If `done`: state=`done`.
    - If pending: keep state.
    - If error: state=`error`.

### Calling ChatGuru (form-encoded)
```ts
const base = `https://${server}.chatguru.app/api/v1`;
const common = { key, account_id, phone_id, chat_number };

// Add
await fetch(base, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: toFormUrlEncoded({
    action: "chat_add",
    name, text: text?.trim() ? text : " ",
    user_id: user_id ?? "",
    dialog_id: dialog_id ?? "",
    ...common,
  }),
});

// Status
await fetch(base, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: toFormUrlEncoded({
    action: "chat_add_status",
    chat_add_id,
    ...common,
  }),
});
```