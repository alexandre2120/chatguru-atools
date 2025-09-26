-- Migration to add usage tracking per account_id
-- This tracks the total number of chats added per account to enforce 50k limit
-- Note: Upload data is deleted after 45 days, but usage tracking is permanent

-- Add account_id column to workspaces table to track usage
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS account_id text,
ADD COLUMN IF NOT EXISTS total_chats_added int DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_account_id 
ON workspaces(account_id);

-- Create a usage_tracking table for detailed history
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  workspace_hash text NOT NULL REFERENCES workspaces(workspace_hash) ON DELETE CASCADE,
  upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  chats_added int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create index for usage tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_account_id 
ON usage_tracking(account_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at 
ON usage_tracking(created_at);

-- Function to get total usage for an account_id
CREATE OR REPLACE FUNCTION get_account_usage(p_account_id text)
RETURNS int AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(chats_added) 
     FROM usage_tracking 
     WHERE account_id = p_account_id),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the limit
COMMENT ON COLUMN workspaces.total_chats_added IS 'Total de chats adicionados por este account_id. Limite máximo: 50.000';
COMMENT ON TABLE usage_tracking IS 'Rastreamento detalhado de uso por account_id para aplicar limite de 50.000 chats';
