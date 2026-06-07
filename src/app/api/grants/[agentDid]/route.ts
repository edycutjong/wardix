import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentDid: string }> }
) {
  try {
    const { agentDid } = await params;
    const db = getDb();

    // Revoke by removing the grant entry
    const initialLength = db.grants.length;
    db.grants = db.grants.filter(g => g.agentDid !== agentDid);

    if (db.grants.length === initialLength) {
      return NextResponse.json(
        { error: 'Grant not found' },
        { status: 404 }
      );
    }

    saveDb(db);
    return NextResponse.json({ success: true, message: 'Grant revoked' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
