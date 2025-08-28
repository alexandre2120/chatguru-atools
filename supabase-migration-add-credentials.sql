-- Migration to add credentials column to uploads table
-- This stores encrypted credentials temporarily for cron job processing

ALTER TABLE uploads 
ADD COLUMN IF NOT EXISTS credentials jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN uploads.credentials IS 'Encrypted ChatGuru credentials (key, phoneId) for API calls. Temporarily stored for cron job access.';

-- Add RLS policy for credentials column (only workspace owner can see)
CREATE POLICY "credentials secure" ON uploads 
  FOR ALL USING (workspace_hash = current_setting('app.workspace_hash', true));