import { NextResponse } from 'next/server';
import { resetDb } from '@/lib/db';

export async function POST() {
  try {
    resetDb();
    return NextResponse.json({ success: true, message: 'Database reset to default settings.' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
