import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceHash = request.headers.get('x-workspace-hash');

    if (!workspaceHash) {
      return NextResponse.json(
        { error: 'Workspace não identificado' },
        { status: 400 }
      );
    }

    const supabase = createServerClient(workspaceHash);

    // Verify upload exists and belongs to workspace
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', id)
      .eq('workspace_hash', workspaceHash)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: 'Upload não encontrado' },
        { status: 404 }
      );
    }

    // Check if upload can be canceled
    if (upload.status !== 'running' && upload.status !== 'queued') {
      return NextResponse.json(
        { error: 'Este upload não pode ser cancelado pois já foi finalizado' },
        { status: 400 }
      );
    }

    // Update all queued items to canceled
    const { error: itemsError } = await supabase
      .from('upload_items')
      .update({
        state: 'error',
        last_error_message: 'Processamento cancelado pelo usuário',
        last_error_code: -1,
        updated_at: new Date().toISOString(),
      })
      .eq('upload_id', id)
      .eq('state', 'queued');

    if (itemsError) {
      console.error('Error canceling items:', itemsError);
    }

    // Update upload status to canceled
    const { data: updatedUpload, error: updateError } = await supabase
      .from('uploads')
      .update({
        status: 'canceled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the cancellation
    await supabase.from('run_logs').insert({
      workspace_hash: workspaceHash,
      upload_id: id,
      phase: 'cancel',
      level: 'warn',
      message: 'Upload cancelado pelo usuário',
    });

    return NextResponse.json({
      success: true,
      upload: updatedUpload,
    });
  } catch (error) {
    console.error('Error canceling upload:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar processamento' },
      { status: 500 }
    );
  }
}