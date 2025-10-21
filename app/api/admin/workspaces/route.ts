import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function verifyAdminSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret || !secret) {
    return false;
  }
  
  return secret === adminSecret;
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Get all workspaces with their stats
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get stats for each workspace
    const workspacesWithStats = await Promise.all(
      (workspaces || []).map(async (workspace) => {
        const { data: uploads } = await supabase
          .from('uploads')
          .select('id, status')
          .eq('workspace_hash', workspace.workspace_hash);

        const { count: totalItems } = await supabase
          .from('upload_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_hash', workspace.workspace_hash);

        const { data: itemsByState } = await supabase
          .from('upload_items')
          .select('state')
          .eq('workspace_hash', workspace.workspace_hash);

        const states: Record<string, number> = {};
        itemsByState?.forEach((item: any) => {
          states[item.state] = (states[item.state] || 0) + 1;
        });

        return {
          ...workspace,
          totalUploads: uploads?.length || 0,
          activeUploads: uploads?.filter((u: any) => 
            ['queued', 'running', 'checking'].includes(u.status)
          ).length || 0,
          totalItems: totalItems || 0,
          itemsByState: states,
        };
      })
    );

    return NextResponse.json({ workspaces: workspacesWithStats });
  } catch (error) {
    console.error('Workspaces error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
