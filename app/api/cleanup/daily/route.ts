import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    // Delete old completed uploads and their items (cascade will handle items)
    const { data: deletedUploads, error: deleteError } = await supabase
      .from('uploads')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', fortyFiveDaysAgo.toISOString())
      .select();

    if (deleteError) {
      console.error('Error deleting old uploads:', deleteError);
      return NextResponse.json(
        { error: 'Failed to cleanup old data' },
        { status: 500 }
      );
    }

    // Delete old logs
    const { data: deletedLogs, error: logsError } = await supabase
      .from('run_logs')
      .delete()
      .lt('at', fortyFiveDaysAgo.toISOString())
      .select();

    return NextResponse.json({
      success: true,
      deleted: {
        uploads: deletedUploads?.length || 0,
        logs: deletedLogs?.length || 0,
      },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}