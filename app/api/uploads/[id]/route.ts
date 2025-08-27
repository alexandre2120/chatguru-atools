import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
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

    // Fetch upload
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', id)
      .eq('workspace_hash', workspaceHash)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Fetch recent items (limit to 100 for performance)
    const { data: items, error: itemsError } = await supabase
      .from('upload_items')
      .select('*')
      .eq('upload_id', id)
      .order('row_index', { ascending: true })
      .limit(100);

    // Get counts by state
    const { data: stateCounts } = await supabase
      .from('upload_items')
      .select('state')
      .eq('upload_id', id);

    const counts = {
      queued: 0,
      processing: 0,
      done: 0,
      error: 0,
    };

    stateCounts?.forEach((item: any) => {
      switch (item.state) {
        case 'queued':
          counts.queued++;
          break;
        case 'adding':
        case 'waiting_status':
          counts.processing++;
          break;
        case 'done':
          counts.done++;
          break;
        case 'error':
          counts.error++;
          break;
      }
    });

    return NextResponse.json({
      upload,
      items: items || [],
      counts,
      total_items: stateCounts?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}