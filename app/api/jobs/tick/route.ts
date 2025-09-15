import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { formEncodedRequest } from '@/utils/chatguru';
import type { UploadItem } from '@/types/database';

const MOCK_CHATGURU = process.env.MOCK_CHATGURU === 'true';

export async function GET(request: NextRequest) {
  return handleTickRequest(request);
}

export async function POST(request: NextRequest) {
  return handleTickRequest(request);
}

async function handleTickRequest(request: NextRequest) {
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
      .select('workspace_hash, last_outbound_at, server, account_id')
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

      // Get active uploads for this workspace (skip canceled) with credentials
      const { data: uploads } = await supabase
        .from('uploads')
        .select('id, status, credentials')
        .eq('workspace_hash', workspace.workspace_hash)
        .in('status', ['queued', 'running'])
        .limit(1);

      if (!uploads || uploads.length === 0) continue;

      const uploadId = uploads[0].id;

      // Process both: add one new item AND check one waiting item
      // This ensures continuous progress visualization
      
      // First, check status of a waiting item (if any)
      const { data: waitingItem } = await supabase
        .from('upload_items')
        .select('*')
        .eq('upload_id', uploadId)
        .eq('state', 'waiting_status')
        .order('updated_at', { ascending: true })
        .limit(1)
        .single();

      if (waitingItem && waitingItem.chat_add_id) {
        const checkResult = await processCheckStatus(waitingItem, workspace, uploads[0], supabase);
        results.push(checkResult);
        
        // If we successfully checked an item, now try to add a new one
        // This creates a continuous flow: check previous + add new
        const { data: queuedItem } = await supabase
          .from('upload_items')
          .select('*')
          .eq('upload_id', uploadId)
          .eq('state', 'queued')
          .order('row_index', { ascending: true })
          .limit(1)
          .single();

        if (queuedItem) {
          const addResult = await processAddChat(queuedItem, workspace, uploads[0], supabase);
          results.push(addResult);
        }
      } else {
        // No waiting items, just add a new one
        const { data: queuedItem } = await supabase
          .from('upload_items')
          .select('*')
          .eq('upload_id', uploadId)
          .eq('state', 'queued')
          .order('row_index', { ascending: true })
          .limit(1)
          .single();

        if (queuedItem) {
          const result = await processAddChat(queuedItem, workspace, uploads[0], supabase);
          results.push(result);
        }
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

async function processAddChat(item: UploadItem, workspace: any, upload: any, supabase: any) {
  const workspaceHash = workspace.workspace_hash;
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

    // Get credentials from upload (passed from frontend)
    const credentials = upload.credentials || {};
    
    // Validate credentials
    if (!credentials.key || !credentials.phoneId) {
      throw new Error('Credenciais ausentes no upload');
    }
    
    // Use server and account_id from workspace (already validated)
    credentials.server = workspace.server || 's10';
    credentials.accountId = workspace.account_id;
    
    if (MOCK_CHATGURU) {
      // Mock response
      const mockChatAddId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
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
      text: item.text?.trim() || '',  // formEncodedRequest will handle empty text
      user_id: item.user_id || '',
      dialog_id: item.dialog_id || '',
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncodedRequest(body),
    });

    const result = await response.json();

    if (response.ok && result.chat_add_id) {
      await supabase
        .from('upload_items')
        .update({
          state: 'waiting_status',
          chat_add_id: result.chat_add_id,
          last_error_message: result.description || 'Chat cadastrado para inclusão com sucesso!',
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

async function processCheckStatus(item: UploadItem, workspace: any, upload: any, supabase: any) {
  const workspaceHash = workspace.workspace_hash;
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

    // Get credentials from upload (passed from frontend)
    const credentials = upload.credentials || {};
    
    // Validate credentials
    if (!credentials.key || !credentials.phoneId) {
      throw new Error('Credenciais ausentes no upload');
    }
    
    // Use server and account_id from workspace (already validated)
    credentials.server = workspace.server || 's10';
    credentials.accountId = workspace.account_id;
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
      body: formEncodedRequest(body),
    });

    const result = await response.json();

    if (response.ok && result.chat_add_status === 'done') {
      await supabase
        .from('upload_items')
        .update({
          state: 'done',
          last_error_message: result.description || 'Chat adicionado com sucesso!',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      return { success: true, itemId: item.id, action: 'status' };
    } else if (response.ok && result.chat_add_status === 'pending') {
      // Keep as waiting_status but update description
      await supabase
        .from('upload_items')
        .update({
          last_error_message: result.description || 'Processando...',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
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
  
  // FIX: Upload só deve ser marcado como completed quando:
  // 1. Todos os itens foram processados (succeeded + failed = total)
  // 2. E não há itens em estado de processamento (adding, waiting_status)
  // 3. E não há itens ainda na fila (queued)
  const hasItemsToProcess = counts.queued > 0 || counts.processing > 0;
  const allItemsProcessed = processed === counts.total;
  
  const isCompleted = allItemsProcessed && !hasItemsToProcess;
  
  // Check if upload was canceled
  if (upload.status === 'canceled') {
    return; // Skip updating stats for canceled uploads
  }
  
  // Track new successful additions
  const newSuccessful = counts.succeeded - previousSucceeded;
  if (newSuccessful > 0 && upload.workspaces?.account_id) {
    // FIX: Adicionar try/catch para evitar que erro no usage_tracking trave o upload
    try {
      await supabase
        .from('usage_tracking')
        .insert({
          account_id: upload.workspaces.account_id,
          workspace_hash: upload.workspace_hash,
          upload_id: uploadId,
          chats_added: newSuccessful,
        });
    } catch (usageError: any) {
      // Log o erro mas não interrompe o processamento
      await supabase.from('run_logs').insert({
        workspace_hash: upload.workspace_hash,
        upload_id: uploadId,
        phase: 'tick',
        level: 'warn',
        message: `Failed to track usage: ${usageError.message}`,
      });
    }
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

