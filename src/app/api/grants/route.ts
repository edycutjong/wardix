import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { T3nClient, createEthAuthInput } from '@/lib/t3n';

export async function GET() {
  const db = getDb();
  return NextResponse.json(db.grants);
}

export async function POST(request: Request) {
  try {
    const { agentDid, functions, allowedHosts } = await request.json();

    if (!agentDid || !Array.isArray(functions) || !Array.isArray(allowedHosts)) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters' },
        { status: 400 }
      );
    }

    const client = new T3nClient({
      sandboxToken: process.env.T3N_SANDBOX_TOKEN || 'test-sandbox-token-00000000000000000000000000000'
    });
    await client.handshake();
    await client.authenticate(createEthAuthInput('0xWardixAdmin'));

    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'agent-auth-update',
      input: {
        agents: [
          {
            agentDid,
            scripts: [
              {
                scriptName: 'tee:user/contracts',
                versionReq: '>=1.0.0',
                functions,
                allowedHosts
              }
            ]
          }
        ]
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
