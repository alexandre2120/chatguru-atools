import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Chats');

    worksheet.columns = [
      { header: 'chat_number', key: 'chat_number', width: 20 },
      { header: 'name', key: 'name', width: 30 },
      { header: 'text', key: 'text', width: 50 },
      { header: 'user_id', key: 'user_id', width: 20 },
      { header: 'dialog_id', key: 'dialog_id', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    
    worksheet.addRow({
      chat_number: '5511999888777',
      name: 'João Silva',
      text: 'Olá, primeira mensagem',
      user_id: 'user123',
      dialog_id: 'dialog456',
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=add-chats-template.xlsx',
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}