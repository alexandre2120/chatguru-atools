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

    // Check if credentials are valid by making a test request to ChatGuru
    const isMockMode = process.env.MOCK_CHATGURU === 'true';
    let credentialsValid = false;
    let validationError = '';

    if (isMockMode) {
      // In mock mode, always consider credentials valid
      credentialsValid = true;
    } else {
      // Validate credentials by attempting to add a test chat with a fictitious number
      try {
        const baseUrl = `https://${server}.chatguru.app/api/v1`;
        
        // Try to add a chat with a completely fictitious number
        // This number is intentionally invalid: +00 00 90000-0000
        const testNumber = '00009000000000';
        
        const response = await fetch(`${baseUrl}/chat_add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formEncodedRequest({
            key,
            account_id: accountId,
            phone_id: phoneId,
            chat_number: testNumber,
            name: 'Teste de Validação',
            text: ' ', // Send a space as required
          }),
        });

        if (response.ok) {
          const data = await response.json();
          
          // If we get a chat_add_id, credentials are valid
          // The chat creation might fail later, but credentials work
          if (data.chat_add_id) {
            credentialsValid = true;
          } else if (data.error) {
            // Check for specific error messages
            if (data.error.toLowerCase().includes('auth') || 
                data.error.toLowerCase().includes('key') ||
                data.error.toLowerCase().includes('account')) {
              credentialsValid = false;
              validationError = 'Credenciais inválidas. Verifique sua API Key, Account ID e Phone ID';
            } else {
              // Other errors mean credentials are valid but something else failed
              credentialsValid = true;
            }
          }
        } else if (response.status === 401 || response.status === 403) {
          credentialsValid = false;
          validationError = 'Credenciais inválidas. Verifique sua API Key e IDs';
        } else if (response.status === 404) {
          credentialsValid = false;
          validationError = `Servidor ${server} não encontrado. Verifique o nome do servidor`;
        } else if (response.status >= 500) {
          credentialsValid = false;
          validationError = 'Erro no servidor do ChatGuru. Tente novamente mais tarde';
        } else {
          credentialsValid = false;
          validationError = `Erro ao validar credenciais (código: ${response.status})`;
        }
      } catch (error: any) {
        console.error('Error validating credentials:', error);
        credentialsValid = false;
        
        if (error.message?.includes('fetch')) {
          validationError = `Não foi possível conectar ao servidor ${server}. Verifique o nome do servidor`;
        } else {
          validationError = 'Erro ao conectar com o ChatGuru. Verifique sua conexão';
        }
      }
    }

    if (!credentialsValid) {
      return NextResponse.json({
        valid: false,
        error: validationError,
        hasActiveUploads: false,
        uploads: []
      });
    }

    // Now check for active uploads and usage limits in the database
    const supabase = createServerClient(hash);

    // First, ensure workspace exists with account_id
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .upsert({
        workspace_hash: hash,
        account_id: accountId,
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