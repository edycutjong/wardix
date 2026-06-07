/**
 * Wardix real lifecycle demo — live Terminal 3 testnet. No mocks.
 *
 * Proves the control-plane value prop with the real delegation contract:
 *   1. ALLOW            — agent invokes an in-scope function under a valid grant
 *   2. DENY (scope)     — agent invokes a function NOT in its grant
 *   3. DENY (revoked)   — org revokes the grant; agent's next call is denied
 *   4. DENY (expired)   — grant past its validity window is denied
 *
 * Requires a funded testnet key in T3N_SANDBOX_TOKEN (acts as org + agent).
 */
import {
  connect,
  issueGrant,
  invoke,
  revoke,
  newAgentIdentity,
  getNodeUrl,
  type Verdict,
} from '../src/lib/t3n-real';

const PAYROLL_VERSION = process.env.T3N_PAYROLL_VERSION || '5.1.4';

function show(label: string, v: Verdict) {
  const mark = v.verdict === 'allow' ? '✅ ALLOW' : '❌ DENY';
  console.log(
    `\n${label}\n  ${mark} — ${v.reason}` +
      (v.businessNote ? `\n  (business layer: ${v.businessNote})` : '') +
      (v.requestId ? `\n  request_id: ${v.requestId}` : '')
  );
}

function baseRequest(orgDid: string) {
  return {
    org_id: orgDid,
    cycle_id: 'cycle-2026-06',
    pay_period_start: '2026-06-01',
    pay_period_end: '2026-06-15',
    batch_cap_cents: 5_000_000n,
    historical_baselines: {} as Record<string, string>,
  };
}

async function main() {
  const key = process.env.T3N_SANDBOX_TOKEN;
  if (!key) throw new Error('Set T3N_SANDBOX_TOKEN (funded testnet key) to run the real demo.');

  console.log('Node:', getNodeUrl());
  console.log('Connecting (handshake + Ethereum auth)...');
  const org = await connect(key);
  console.log('Org/Agent DID:', org.did);

  // The funded account acts as the agent too (single-account demo): its EOA
  // key both authenticates and signs each invocation.
  const agentId = newAgentIdentity(key);

  // 1) ALLOW — valid grant including the called function
  {
    const grant = await issueGrant({
      org,
      agentPubkey: agentId.pubkey,
      functions: ['compute-payroll', 'execute-disbursement'],
      scopes: ['payroll/employees'],
    });
    const v = await invoke({
      agent: org,
      agentSecret: agentId.privateKey,
      grant,
      functionName: 'compute-payroll',
      scriptVersion: PAYROLL_VERSION,
      request: baseRequest(org.did),
    });
    show('1) In-scope call under a valid grant', v);
  }

  // 2) DENY (out of scope) — grant lacks the called function
  {
    const grant = await issueGrant({
      org,
      agentPubkey: agentId.pubkey,
      functions: ['compute-payroll'], // execute-disbursement NOT granted
    });
    const v = await invoke({
      agent: org,
      agentSecret: agentId.privateKey,
      grant,
      functionName: 'execute-disbursement',
      scriptVersion: PAYROLL_VERSION,
      request: baseRequest(org.did),
    });
    show('2) Out-of-scope function (not in grant)', v);
  }

  // 3) DENY (revoked) — revoke then call
  {
    const grant = await issueGrant({
      org,
      agentPubkey: agentId.pubkey,
      functions: ['compute-payroll'],
    });
    const r = await revoke({ org, grant });
    console.log('\n3) Revoked grant on-chain:', JSON.stringify(r));
    const v = await invoke({
      agent: org,
      agentSecret: agentId.privateKey,
      grant,
      functionName: 'compute-payroll',
      scriptVersion: PAYROLL_VERSION,
      request: baseRequest(org.did),
    });
    show('3) Call after revocation', v);
  }

  // 4) DENY (expired) — short-lived grant that lapses before the call
  {
    const grant = await issueGrant({
      org,
      agentPubkey: agentId.pubkey,
      functions: ['compute-payroll'],
      ttlSecs: 2, // TEE won't sign an already-expired credential; let it lapse
    });
    console.log('\n4) Issued a 2s grant; waiting for it to expire...');
    await new Promise((r) => setTimeout(r, 4000));
    const v = await invoke({
      agent: org,
      agentSecret: agentId.privateKey,
      grant,
      functionName: 'compute-payroll',
      scriptVersion: PAYROLL_VERSION,
      request: baseRequest(org.did),
    });
    show('4) Expired grant', v);
  }

  console.log('\nDone — all verdicts above are live tee:payroll / tee:delegation responses.');
}

main().catch((e) => {
  console.error('DEMO FAILED:', e?.stack || e?.message || e);
  process.exit(1);
});
