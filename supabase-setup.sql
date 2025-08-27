-- Supabase schema for ChatGuru Add & Import Chats atool
-- Execute this in your Supabase SQL Editor

-- Drop existing tables if needed (BE CAREFUL IN PRODUCTION!)
-- drop table if exists run_logs cascade;
-- drop table if exists upload_items cascade;
-- drop table if exists uploads cascade;
-- drop table if exists workspaces cascade;

create table if not exists workspaces (
  workspace_hash text primary key,
  last_outbound_at timestamptz,
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
  status text not null default 'queued',
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
  text text,
  user_id text,
  dialog_id text,
  state text not null default 'queued',
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
  phase text not null,
  level text not null default 'info',
  message text,
  code int,
  at timestamptz default now()
);

-- Indexes
create index if not exists idx_uploads_ws on uploads(workspace_hash);
create index if not exists idx_items_ws_state on upload_items(workspace_hash, state);
create index if not exists idx_items_upload on upload_items(upload_id);
create index if not exists idx_logs_ws_at on run_logs(workspace_hash, at desc);

-- For now, disable RLS to simplify testing
alter table workspaces disable row level security;
alter table uploads disable row level security;
alter table upload_items disable row level security;
alter table run_logs disable row level security;

-- Grant permissions (adjust based on your needs)
grant all on workspaces to anon, authenticated;
grant all on uploads to anon, authenticated;
grant all on upload_items to anon, authenticated;
grant all on run_logs to anon, authenticated;