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

    const supabase = createServerClient();

    console.log('🔍 Fetching data from Supabase...');

    // Get total uploads
    const { count: totalUploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('id', { count: 'exact', head: true });
    
    if (uploadsError) {
      console.error('❌ Error fetching uploads:', uploadsError);
    } else {
      console.log('✅ Total uploads:', totalUploads);
    }

    // Get active uploads (queued, running, checking)
    const { count: activeUploads } = await supabase
      .from('uploads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued', 'running', 'checking']);

    // Get total items
    const { count: totalItems } = await supabase
      .from('upload_items')
      .select('id', { count: 'exact', head: true });

    // Get items by state
    const { data: itemsData } = await supabase
      .from('upload_items')
      .select('state');

    const itemsByState: Record<string, number> = {};
    itemsData?.forEach((item: any) => {
      itemsByState[item.state] = (itemsByState[item.state] || 0) + 1;
    });

    // Get recent items (last 50 updated)
    const { data: recentItems } = await supabase
      .from('upload_items')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      stats: {
        totalUploads: totalUploads || 0,
        activeUploads: activeUploads || 0,
        totalItems: totalItems || 0,
        itemsByState,
      },
      recentItems: recentItems || [],
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
