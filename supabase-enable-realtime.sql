-- Enable Realtime for tables that need live updates
-- This allows the UI to update automatically when data changes

-- Enable realtime for uploads table
ALTER PUBLICATION supabase_realtime ADD TABLE uploads;

-- Enable realtime for upload_items table
ALTER PUBLICATION supabase_realtime ADD TABLE upload_items;

-- Note: workspaces and run_logs don't need realtime as they're not displayed live