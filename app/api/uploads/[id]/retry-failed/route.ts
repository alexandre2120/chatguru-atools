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
        { error: 'Missing workspace hash' },
        { status: 400 }
      );
    }

    const supabase = createServerClient(workspaceHash);

    // Reset failed items to queued
    const { data, error } = await supabase
      .from('upload_items')
      .update({
        state: 'queued',
        attempts: 0,
        last_error_code: null,
        last_error_message: null,
        chat_add_id: null,
      })
      .eq('upload_id', id)
      .eq('state', 'error')
      .select();

    if (error) {
      console.error('Error resetting failed items:', error);
      return NextResponse.json(
        { error: 'Failed to reset items' },
        { status: 500 }
      );
    }

    // Update upload status back to queued if it was completed
    await supabase
      .from('uploads')
      .update({
        status: 'queued',
        completed_at: null,
      })
      .eq('id', id)
      .eq('status', 'completed');

    // Log the retry
    await supabase.from('run_logs').insert({
      workspace_hash: workspaceHash,
      upload_id: id,
      phase: 'retry',
      level: 'info',
      message: `Reset ${data?.length || 0} failed items to queued`,
    });

    return NextResponse.json({
      success: true,
      reset_count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error in retry-failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}