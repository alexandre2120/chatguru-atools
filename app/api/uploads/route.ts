import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabase/server';
import type { Upload, UploadItem, Workspace } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceHash = formData.get('workspace_hash') as string;

    if (!file || !workspaceHash) {
      return NextResponse.json(
        { error: 'Missing file or workspace_hash' },
        { status: 400 }
      );
    }

    // Initialize Supabase with workspace hash
    const supabase = createServerClient(workspaceHash);

    // Ensure workspace exists
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .upsert({
        workspace_hash: workspaceHash,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (wsError) {
      console.error('Workspace error:', wsError);
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return NextResponse.json(
        { error: 'No worksheet found in file' },
        { status: 400 }
      );
    }

    // Validate columns
    const headerRow = worksheet.getRow(1);
    const expectedColumns = ['chat_number', 'name', 'text', 'user_id', 'dialog_id'];
    const actualColumns: string[] = [];
    
    headerRow.eachCell((cell, colNumber) => {
      actualColumns.push(cell.value?.toString() || '');
    });

    const hasRequiredColumns = expectedColumns.slice(0, 2).every(col => 
      actualColumns.includes(col)
    );

    if (!hasRequiredColumns) {
      return NextResponse.json(
        { error: 'Missing required columns: chat_number, name' },
        { status: 400 }
      );
    }

    // Parse rows
    const items: Omit<UploadItem, 'id' | 'created_at' | 'updated_at'>[] = [];
    let rowIndex = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      const chatNumber = row.getCell(actualColumns.indexOf('chat_number') + 1).value?.toString();
      const name = row.getCell(actualColumns.indexOf('name') + 1).value?.toString();
      
      if (!chatNumber || !name) return; // Skip invalid rows
      
      rowIndex++;
      
      const text = row.getCell(actualColumns.indexOf('text') + 1).value?.toString() || null;
      const userId = row.getCell(actualColumns.indexOf('user_id') + 1).value?.toString() || null;
      const dialogId = row.getCell(actualColumns.indexOf('dialog_id') + 1).value?.toString() || null;

      items.push({
        upload_id: '', // Will be set after upload creation
        workspace_hash: workspaceHash,
        row_index: rowIndex,
        chat_number: chatNumber.trim(),
        name: name.trim(),
        text: text?.trim() || null,
        user_id: userId?.trim() || null,
        dialog_id: dialogId?.trim() || null,
        state: 'queued',
        attempts: 0,
      });
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in file' },
        { status: 400 }
      );
    }

    // Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        workspace_hash: workspaceHash,
        filename: file.name,
        total_rows: items.length,
        processed_rows: 0,
        succeeded_rows: 0,
        failed_rows: 0,
        status: 'queued',
      })
      .select()
      .single();

    if (uploadError || !upload) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to create upload record' },
        { status: 500 }
      );
    }

    // Set upload_id for all items
    items.forEach(item => {
      item.upload_id = upload.id;
    });

    // Insert upload items
    const { error: itemsError } = await supabase
      .from('upload_items')
      .insert(items);

    if (itemsError) {
      console.error('Items error:', itemsError);
      // Delete the upload if items insertion failed
      await supabase.from('uploads').delete().eq('id', upload.id);
      
      return NextResponse.json(
        { error: 'Failed to create upload items' },
        { status: 500 }
      );
    }

    // Log the upload
    await supabase.from('run_logs').insert({
      workspace_hash: workspaceHash,
      upload_id: upload.id,
      phase: 'tick',
      level: 'info',
      message: `Upload created with ${items.length} items`,
    });

    return NextResponse.json({ 
      id: upload.id,
      total_rows: items.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}