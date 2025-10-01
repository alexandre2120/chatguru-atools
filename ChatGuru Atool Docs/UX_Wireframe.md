# UX Wireframe (Black & White, Icon-only Sidebar)

## Sidebar (left, fixed)
- Monochrome logo (top)
- Vertical stack of circular **icon-only** buttons:
  - [Active] Add/Import Chats
  - [Disabled] Placeholder 1
  - [Disabled] Placeholder 2
  - [Disabled] Placeholder 3

## /tools/add-chats
- **Credentials Card**
  - Inputs: server (sX), key, account_id, phone_id
  - Toggle: “Remember in this browser” (localStorage)
  - Helper text: "Processamento: **1 a cada 10 segundos** (~60 a cada 10 min)."
  - Buttons: Download XLSX template, Upload XLSX

- **Jobs Table (Realtime)**
  - Columns: Job ID, Created At, Queued, Processing, Succeeded, Failed, Status, Last Activity, Actions [View, Download failures]
  - Monochrome status badges only

## /tools/add-chats/[uploadId]
- Progress bar + counters
- Realtime items list (virtualized)
  - Columns: row_index, chat_number, name, state, last message / error code
  - Action: Retry failed

## Copy (PT-BR)
- Keep labels concise and neutral; black & white only.