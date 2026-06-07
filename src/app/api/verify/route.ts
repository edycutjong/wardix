import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Live agent-auth verification against the real Terminal 3 testnet.
 *
 * Opt-in: only runs when T3N_LIVE=1 and a funded T3N_SANDBOX_TOKEN is set on
 * the server. The public demo deployment leaves this off so the funded testnet
 * key is never shipped to the browser or required in prod. Locally, with the
 * key configured, this issues a real delegation credential and submits a real
 * delegated invocation to tee:payroll, returning the contract's own verdict.
 *
 * Body: { functions: string[], call: string, ttlSecs?: number, revoke?: boolean }
 */
export async function POST(request: Request) {
  if (process.env.T3N_LIVE !== '1') {
    return NextResponse.json(
      { error: 'Live mode disabled. Set T3N_LIVE=1 and T3N_SANDBOX_TOKEN to enable.' },
      { status: 503 }
    );
  }
  const key = process.env.T3N_SANDBOX_TOKEN;
  if (!key) {
    return NextResponse.json({ error: 'T3N_SANDBOX_TOKEN not configured' }, { status: 503 });
  }

  try {
    const { functions, call, ttlSecs, revoke: doRevoke } = await request.json();
    if (!Array.isArray(functions) || typeof call !== 'string') {
      return NextResponse.json({ error: 'Expected { functions: string[], call: string }' }, { status: 400 });
    }

    // Imported lazily so the WASM/SDK only loads when live mode is used.
    const t3n = await import('@/lib/t3n-real');
    const org = await t3n.connect(key);
    const agentId = t3n.newAgentIdentity(key);
    const grant = await t3n.issueGrant({
      org,
      agentPubkey: agentId.pubkey,
      functions,
      scopes: ['payroll/employees'],
      ttlSecs: ttlSecs ?? 3600,
    });

    if (doRevoke) await t3n.revoke({ org, grant });

    const verdict = await t3n.invoke({
      agent: org,
      agentSecret: agentId.privateKey,
      grant,
      functionName: call,
      scriptVersion: process.env.T3N_PAYROLL_VERSION || '5.1.4',
      request: {
        org_id: org.did,
        cycle_id: 'cycle-2026-06',
        pay_period_start: '2026-06-01',
        pay_period_end: '2026-06-15',
        batch_cap_cents: 5_000_000n,
      },
    });

    return NextResponse.json({
      orgDid: org.did,
      node: t3n.getNodeUrl(),
      grantedFunctions: grant.functions,
      called: call,
      revoked: !!doRevoke,
      ...verdict,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
