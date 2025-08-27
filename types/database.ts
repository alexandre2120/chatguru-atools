export interface Workspace {
  workspace_hash: string;
  last_outbound_at?: string | null;
  created_at: string;
}

export interface Upload {
  id: string;
  workspace_hash: string;
  filename: string;
  total_rows: number;
  processed_rows: number;
  succeeded_rows: number;
  failed_rows: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface UploadItem {
  id: string;
  upload_id: string;
  workspace_hash: string;
  row_index: number;
  chat_number: string;
  name: string;
  text?: string | null;
  user_id?: string | null;
  dialog_id?: string | null;
  state: 'queued' | 'adding' | 'waiting_status' | 'done' | 'error';
  chat_add_id?: string | null;
  last_error_code?: number | null;
  last_error_message?: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface RunLog {
  id: number;
  workspace_hash: string;
  upload_id?: string | null;
  item_id?: string | null;
  phase: 'tick' | 'chat_add' | 'chat_add_status' | 'retry' | 'cleanup';
  level: 'info' | 'warn' | 'error';
  message?: string | null;
  code?: number | null;
  at: string;
}