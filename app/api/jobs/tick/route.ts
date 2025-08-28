import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { toFormUrlEncoded } from '@/utils/form';
import type { UploadItem } from '@/types/database';

const MOCK_CHATGURU = process.env.MOCK_CHATGURU === 'true';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (for Vercel Cron)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get all workspaces with active uploads
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('workspace_hash, last_outbound_at')
      .order('last_outbound_at', { ascending: true, nullsFirst: true });

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ message: 'No workspaces to process' });
    }

    const results = [];

    for (const workspace of workspaces) {
      // Check rate limit: 1 request per minute per workspace
      const now = new Date();
      const lastRequest = workspace.last_outbound_at 
        ? new Date(workspace.last_outbound_at) 
        : null;

      if (lastRequest && (now.getTime() - lastRequest.getTime()) < 60000) {
        console.log(`Skipping workspace ${workspace.workspace_hash} - rate limit`);
        continue;
      }

      // Get active uploads for this workspace
      const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .eq('workspace_hash', workspace.workspace_hash)
        .in('status', ['queued', 'running'])
        .limit(1);

      if (!uploads || uploads.length === 0) continue;

      const uploadId = uploads[0].id;

      // Try to process one queued item
      const { data: queuedItem } = await supabase
        .from('upload_items')
        .select('*')
        .eq('upload_id', uploadId)
        .eq('state', 'queued')
        .order('row_index', { ascending: true })
        .limit(1)
        .single();

      if (queuedItem) {
        const result = await processAddChat(queuedItem, workspace.workspace_hash, supabase);
        results.push(result);
        continue;
      }

      // If no queued items, check status of waiting items
      const { data: waitingItem } = await supabase
        .from('upload_items')
        .select('*')
        .eq('upload_id', uploadId)
        .eq('state', 'waiting_status')
        .order('updated_at', { ascending: true })
        .limit(1)
        .single();

      if (waitingItem && waitingItem.chat_add_id) {
        const result = await processCheckStatus(waitingItem, workspace.workspace_hash, supabase);
        results.push(result);
      }

      // Update upload stats
      await updateUploadStats(uploadId, supabase);
    }

    return NextResponse.json({ 
      processed: results.length,
      results 
    });
  } catch (error) {
    console.error('Tick error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processAddChat(item: UploadItem, workspaceHash: string, supabase: any) {
  try {
    // Update workspace last_outbound_at
    await supabase
      .from('workspaces')
      .update({ last_outbound_at: new Date().toISOString() })
      .eq('workspace_hash', workspaceHash);

    // Update item state
    await supabase
      .from('upload_items')
      .update({ 
        state: 'adding',
        attempts: item.attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    // Get credentials from somewhere (in real app, this would be from a secure source)
    // For now, we'll mock this
    const credentials = await getCredentials(workspaceHash);
    
    if (MOCK_CHATGURU) {
      // Mock response
      const mockChatAddId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await supabase
        .from('upload_items')
        .update({
          state: 'waiting_status',
          chat_add_id: mockChatAddId,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      await supabase.from('run_logs').insert({
        workspace_hash: workspaceHash,
        upload_id: item.upload_id,
        item_id: item.id,
        phase: 'chat_add',
        level: 'info',
        message: `Mock chat_add successful: ${mockChatAddId}`,
      });

      return { success: true, itemId: item.id, action: 'add', mock: true };
    }

    // Real ChatGuru API call
    const server = credentials.server;
    const baseUrl = `https://${server}.chatguru.app/api/v1`;
    
    const body = {
      action: 'chat_add',
      key: credentials.key,
      account_id: credentials.accountId,
      phone_id: credentials.phoneId,
      chat_number: item.chat_number,
      name: item.name,
      text: item.text?.trim() || ' ',
      user_id: item.user_id || '',
      dialog_id: item.dialog_id || '',
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toFormUrlEncoded(body),
    });

    const result = await response.json();

    if (response.ok && result.chat_add_id) {
      await supabase
        .from('upload_items')
        .update({
          state: 'waiting_status',
          chat_add_id: result.chat_add_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      await supabase.from('run_logs').insert({
        workspace_hash: workspaceHash,
        upload_id: item.upload_id,
        item_id: item.id,
        phase: 'chat_add',
        level: 'info',
        message: `Chat add successful: ${result.chat_add_id}`,
      });

      return { success: true, itemId: item.id, action: 'add' };
    } else {
      throw new Error(result.description || 'Chat add failed');
    }
  } catch (error: any) {
    await supabase
      .from('upload_items')
      .update({
        state: 'error',
        last_error_code: error.code || 0,
        last_error_message: error.message || 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    await supabase.from('run_logs').insert({
      workspace_hash: workspaceHash,
      upload_id: item.upload_id,
      item_id: item.id,
      phase: 'chat_add',
      level: 'error',
      message: error.message,
      code: error.code,
    });

    return { success: false, itemId: item.id, action: 'add', error: error.message };
  }
}

async function processCheckStatus(item: UploadItem, workspaceHash: string, supabase: any) {
  try {
    // Update workspace last_outbound_at
    await supabase
      .from('workspaces')
      .update({ last_outbound_at: new Date().toISOString() })
      .eq('workspace_hash', workspaceHash);

    if (MOCK_CHATGURU) {
      // Mock status as done
      await supabase
        .from('upload_items')
        .update({
          state: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      return { success: true, itemId: item.id, action: 'status', mock: true };
    }

    // Real ChatGuru API call
    const credentials = await getCredentials(workspaceHash);
    const server = credentials.server;
    const baseUrl = `https://${server}.chatguru.app/api/v1`;
    
    const body = {
      action: 'chat_add_status',
      key: credentials.key,
      account_id: credentials.accountId,
      phone_id: credentials.phoneId,
      chat_number: item.chat_number,
      chat_add_id: item.chat_add_id!,
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toFormUrlEncoded(body),
    });

    const result = await response.json();

    if (response.ok && result.chat_add_status === 'done') {
      await supabase
        .from('upload_items')
        .update({
          state: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      return { success: true, itemId: item.id, action: 'status' };
    } else if (response.ok && result.chat_add_status === 'pending') {
      // Keep as waiting_status
      return { success: true, itemId: item.id, action: 'status', pending: true };
    } else {
      throw new Error(result.description || 'Status check failed');
    }
  } catch (error: any) {
    await supabase
      .from('upload_items')
      .update({
        state: 'error',
        last_error_code: error.code || 0,
        last_error_message: error.message || 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    return { success: false, itemId: item.id, action: 'status', error: error.message };
  }
}

async function updateUploadStats(uploadId: string, supabase: any) {
  // Get upload info with workspace
  const { data: upload } = await supabase
    .from('uploads')
    .select('*, workspaces!inner(account_id)')
    .eq('id', uploadId)
    .single();

  if (!upload) return;

  // Count items by state
  const { data: stats } = await supabase
    .from('upload_items')
    .select('state')
    .eq('upload_id', uploadId);

  if (!stats) return;

  const counts = {
    queued: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    total: stats.length,
  };

  let previousSucceeded = upload.succeeded_rows || 0;

  stats.forEach((item: any) => {
    switch (item.state) {
      case 'queued':
        counts.queued++;
        break;
      case 'adding':
      case 'waiting_status':
        counts.processing++;
        break;
      case 'done':
        counts.succeeded++;
        break;
      case 'error':
        counts.failed++;
        break;
    }
  });

  const processed = counts.succeeded + counts.failed;
  const isCompleted = processed === counts.total;
  
  // Track new successful additions
  const newSuccessful = counts.succeeded - previousSucceeded;
  if (newSuccessful > 0 && upload.workspaces?.account_id) {
    // Record usage for this account
    await supabase
      .from('usage_tracking')
      .insert({
        account_id: upload.workspaces.account_id,
        workspace_hash: upload.workspace_hash,
        upload_id: uploadId,
        chats_added: newSuccessful,
      });
  }

  await supabase
    .from('uploads')
    .update({
      processed_rows: processed,
      succeeded_rows: counts.succeeded,
      failed_rows: counts.failed,
      status: isCompleted ? 'completed' : 'running',
      started_at: counts.processing > 0 ? new Date().toISOString() : null,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', uploadId);
}

async function getCredentials(workspaceHash: string) {
  // In a real app, you would securely retrieve credentials
  // For now, returning mock credentials
  return {
    server: 's10',
    key: 'mock_key',
    accountId: 'mock_account',
    phoneId: 'mock_phone',
  };
}