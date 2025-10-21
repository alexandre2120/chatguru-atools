-- Script SEGURO para criar tabelas se não existirem
-- NÃO apaga dados existentes
-- Execute este no SQL Editor do Supabase

-- Criar tabela workspaces (se não existir)
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_hash text primary key,
  last_outbound_at timestamptz,
  created_at timestamptz default now()
);

-- Criar tabela uploads (se não existir)
CREATE TABLE IF NOT EXISTS uploads (
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

-- Criar tabela upload_items (se não existir)
CREATE TABLE IF NOT EXISTS upload_items (
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

-- Criar tabela run_logs (se não existir)
CREATE TABLE IF NOT EXISTS run_logs (
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

-- Criar índices (se não existirem)
CREATE INDEX IF NOT EXISTS idx_uploads_ws ON uploads(workspace_hash);
CREATE INDEX IF NOT EXISTS idx_items_ws_state ON upload_items(workspace_hash, state);
CREATE INDEX IF NOT EXISTS idx_items_upload ON upload_items(upload_id);
CREATE INDEX IF NOT EXISTS idx_logs_ws_at ON run_logs(workspace_hash, at desc);

-- Desabilitar RLS (apenas se ainda não estiver desabilitado)
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE upload_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE run_logs DISABLE ROW LEVEL SECURITY;

-- Conceder permissões
GRANT ALL ON workspaces TO anon, authenticated;
GRANT ALL ON uploads TO anon, authenticated;
GRANT ALL ON upload_items TO anon, authenticated;
GRANT ALL ON run_logs TO anon, authenticated;

-- Verificar se as tabelas foram criadas
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.tables t WHERE t.table_name = tables.table_name) as exists
FROM (
  VALUES ('workspaces'), ('uploads'), ('upload_items'), ('run_logs')
) AS tables(table_name);
