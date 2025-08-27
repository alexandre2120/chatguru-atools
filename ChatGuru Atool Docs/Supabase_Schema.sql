-- Supabase schema for ChatGuru Add & Import Chats atool

create table if not exists workspaces (
  workspace_hash text primary key,
  last_outbound_at timestamptz,        -- for 1 req/min gating
  created_at timestamptz default now()
);

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_hash text not null references workspaces(workspace_hash) on delete cascade,
  filename text not null,
  total_rows int not null default 0,
  processed_rows int not null default 0,
  succeeded_rows int not null default 0,
  failed_rows int not null default 0,
  status text not null default 'queued', -- queued|running|completed|failed|canceled
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists upload_items (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  workspace_hash text not null,
  row_index int not null,
  chat_number text not null,
  name text not null,
  text text,            -- optional; send " " if null/empty
  user_id text,
  dialog_id text,
  state text not null default 'queued',  -- queued|adding|waiting_status|done|error
  chat_add_id text,
  last_error_code int,
  last_error_message text,
  attempts int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists run_logs (
  id bigint generated always as identity primary key,
  workspace_hash text not null,
  upload_id uuid,
  item_id uuid,
  phase text not null,                 -- tick|chat_add|chat_add_status|retry|cleanup
  level text not null default 'info',  -- info|warn|error
  message text,
  code int,
  at timestamptz default now()
);

-- Indexes
create index if not exists idx_uploads_ws on uploads(workspace_hash);
create index if not exists idx_items_ws_state on upload_items(workspace_hash, state);
create index if not exists idx_items_upload on upload_items(upload_id);
create index if not exists idx_logs_ws_at on run_logs(workspace_hash, at desc);

-- RLS
alter table workspaces enable row level security;
alter table uploads enable row level security;
alter table upload_items enable row level security;
alter table run_logs enable row level security;

-- Policies based on a per-request setting: app.workspace_hash
create policy "ws read"   on workspaces   for select using (workspace_hash = current_setting('app.workspace_hash', true));
create policy "ws insert" on workspaces   for insert with check (workspace_hash = current_setting('app.workspace_hash', true));

create policy "up read"   on uploads      for select using (workspace_hash = current_setting('app.workspace_hash', true));
create policy "up write"  on uploads      for insert with check (workspace_hash = current_setting('app.workspace_hash', true));
create policy "up upd"    on uploads      for update using (workspace_hash = current_setting('app.workspace_hash', true));

create policy "it read"   on upload_items for select using (workspace_hash = current_setting('app.workspace_hash', true));
create policy "it write"  on upload_items for insert with check (workspace_hash = current_setting('app.workspace_hash', true));
create policy "it upd"    on upload_items for update using (workspace_hash = current_setting('app.workspace_hash', true));

create policy "log read"  on run_logs     for select using (workspace_hash = current_setting('app.workspace_hash', true));