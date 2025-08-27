import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
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

    // Fetch failed items
    const { data: failedItems, error } = await supabase
      .from('upload_items')
      .select('*')
      .eq('upload_id', id)
      .eq('state', 'error')
      .order('row_index', { ascending: true });

    if (error) {
      console.error('Error fetching failed items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      );
    }

    if (!failedItems || failedItems.length === 0) {
      return NextResponse.json(
        { error: 'No failed items found' },
        { status: 404 }
      );
    }

    // Create Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Failures');

    worksheet.columns = [
      { header: 'row_index', key: 'row_index', width: 10 },
      { header: 'chat_number', key: 'chat_number', width: 20 },
      { header: 'name', key: 'name', width: 30 },
      { header: 'text', key: 'text', width: 50 },
      { header: 'user_id', key: 'user_id', width: 20 },
      { header: 'dialog_id', key: 'dialog_id', width: 20 },
      { header: 'error_code', key: 'error_code', width: 15 },
      { header: 'error_message', key: 'error_message', width: 50 },
      { header: 'chat_add_id', key: 'chat_add_id', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };

    failedItems.forEach(item => {
      worksheet.addRow({
        row_index: item.row_index,
        chat_number: item.chat_number,
        name: item.name,
        text: item.text || '',
        user_id: item.user_id || '',
        dialog_id: item.dialog_id || '',
        error_code: item.last_error_code || '',
        error_message: item.last_error_message || '',
        chat_add_id: item.chat_add_id || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=failures-${id}.xlsx`,
      },
    });
  } catch (error) {
    console.error('Error generating failures export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}