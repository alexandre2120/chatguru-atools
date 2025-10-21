import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();
    
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (!adminSecret) {
      return NextResponse.json(
        { error: 'Admin secret not configured' },
        { status: 500 }
      );
    }
    
    const authenticated = secret === adminSecret;
    
    return NextResponse.json({ authenticated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
