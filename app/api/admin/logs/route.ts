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
    // Verify admin secret
    if (!verifyAdminSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 100);
    const level = searchParams.get('level');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    let countQuery = supabase
      .from('run_logs')
      .select('id', { count: 'exact', head: true });

    let logsQuery = supabase
      .from('run_logs')
      .select('*')
      .order('at', { ascending: false });

    // Apply filters
    if (level && level !== 'all') {
      countQuery = countQuery.eq('level', level);
      logsQuery = logsQuery.eq('level', level);
    }

    if (search) {
      countQuery = countQuery.ilike('message', `%${search}%`);
      logsQuery = logsQuery.ilike('message', `%${search}%`);
    }

    // Get total count
    const { count: total } = await countQuery;

    // Get logs with pagination
    const { data: logs } = await logsQuery.range(offset, offset + limit - 1);

    return NextResponse.json({
      logs: logs || [],
      total: total || 0,
      page,
      limit,
      totalPages: Math.ceil((total || 0) / limit),
    });
  } catch (error) {
    console.error('Logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
