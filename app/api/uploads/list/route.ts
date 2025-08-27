import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const workspaceHash = request.headers.get('x-workspace-hash');

    if (!workspaceHash) {
      return NextResponse.json(
        { error: 'Missing workspace hash' },
        { status: 400 }
      );
    }

    const supabase = createServerClient(workspaceHash);

    // Fetch uploads for this workspace
    const { data: uploads, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('workspace_hash', workspaceHash)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching uploads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch uploads' },
        { status: 500 }
      );
    }

    // Check if there are active uploads (queued or running)
    const hasActiveUploads = uploads?.some(
      upload => upload.status === 'queued' || upload.status === 'running'
    ) || false;

    return NextResponse.json({
      uploads: uploads || [],
      hasActiveUploads,
    });
  } catch (error) {
    console.error('Error in list uploads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}