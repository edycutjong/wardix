import { NextResponse } from 'next/server';
import { checkPreflight } from '@/lib/preflight';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentDid, fn, host, amount } = body;

    if (!agentDid || !fn) {
      return NextResponse.json(
        { error: 'Missing agentDid or fn' },
        { status: 400 }
      );
    }

    const result = checkPreflight({ agentDid, fn, host, amount });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
