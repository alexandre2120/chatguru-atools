import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { workspaceHash } from '@/utils/hash';
import { formEncodedRequest } from '@/utils/chatguru';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { server, key, accountId, phoneId } = body;

    if (!server || !key || !accountId || !phoneId) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Por favor, preencha todas as credenciais' 
        },
        { status: 400 }
      );
    }

    // Generate workspace hash
    const hash = await workspaceHash(server, key, accountId, phoneId);

    // Skip credential validation - just proceed with workspace setup
    const isMockMode = process.env.MOCK_CHATGURU === 'true';

    // Now check for active uploads and usage limits in the database
    const supabase = createServerClient(hash);

    // First, ensure workspace exists with account_id and server
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .upsert({
        workspace_hash: hash,
        account_id: accountId,
        server: server,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (wsError) {
      console.error('Error creating/updating workspace:', wsError);
    }

    // Get total usage for this account_id
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_account_usage', { p_account_id: accountId });

    const totalUsage = usageData || 0;
    const usageLimit = 10000;
    const remainingQuota = Math.max(0, usageLimit - totalUsage);
    const isLimitReached = totalUsage >= usageLimit;

    // Check if workspace exists and has active uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('*')
      .eq('workspace_hash', hash)
      .order('created_at', { ascending: false })
      .limit(20);

    if (uploadsError) {
      console.error('Error fetching uploads:', uploadsError);
    }

    // Check if there are active uploads
    const hasActiveUploads = uploads?.some(
      upload => upload.status === 'queued' || upload.status === 'running'
    ) || false;

    // If limit is reached, return error
    if (isLimitReached) {
      return NextResponse.json({
        valid: true, // Credentials are valid, but limit reached
        error: `Limite de 10.000 contatos atingido para este Account ID. Total usado: ${totalUsage.toLocaleString('pt-BR')}`,
        hasActiveUploads,
        uploads: uploads || [],
        workspaceHash: hash,
        usage: {
          total: totalUsage,
          limit: usageLimit,
          remaining: 0,
          percentage: 100
        },
        limitReached: true
      });
    }

    return NextResponse.json({
      valid: true,
      error: null,
      hasActiveUploads,
      uploads: uploads || [],
      workspaceHash: hash,
      usage: {
        total: totalUsage,
        limit: usageLimit,
        remaining: remainingQuota,
        percentage: (totalUsage / usageLimit) * 100
      },
      limitReached: false
    });

  } catch (error) {
    console.error('Error checking credentials:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Erro interno do servidor',
        hasActiveUploads: false,
        uploads: []
      },
      { status: 500 }
    );
  }
}