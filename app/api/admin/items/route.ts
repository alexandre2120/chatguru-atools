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
    const state = searchParams.get('state');
    const workspaceHash = searchParams.get('workspace_hash');
    const uploadId = searchParams.get('upload_id');
    const search = searchParams.get('search'); // search by name or chat_number
    
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    let query = supabase
      .from('upload_items')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (state) {
      query = query.eq('state', state);
    }

    if (workspaceHash) {
      query = query.eq('workspace_hash', workspaceHash);
    }

    if (uploadId) {
      query = query.eq('upload_id', uploadId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,chat_number.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: items, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      items: items || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Items error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
