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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const status = searchParams.get('status');
    const workspaceHash = searchParams.get('workspace_hash');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    let query = supabase
      .from('uploads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (workspaceHash) {
      query = query.eq('workspace_hash', workspaceHash);
    }

    if (search) {
      query = query.ilike('filename', `%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: uploads, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      uploads: uploads || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Uploads error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
