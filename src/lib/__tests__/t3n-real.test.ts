import { describe, it, expect, vi } from 'vitest';

// Mock the Terminal 3 SDK so we exercise the adapter's own logic (verdict
// classification, identity) without any network or WASM. @noble/curves stays
// real so newAgentIdentity computes a genuine secp256k1 key.
vi.mock('@terminal3/t3n-sdk', () => ({
  buildPayrollInvocation: vi.fn(() => ({
    envelope: {
      credential_jcs: new Uint8Array([1]),
      user_sig: new Uint8Array([2]),
      agent_sig: new Uint8Array([3]),
      nonce: new Uint8Array([4]),
      request_hash: new Uint8Array([5]),
    },
    request: {
      org_id: 'did:t3n:org',
      cycle_id: 'c',
      pay_period_start: 'a',
      pay_period_end: 'b',
      batch_cap_cents: 5000000n,
      individual_disbursement_threshold_cents: 1500000n,
    },
  })),
  b64uEncodeBytes: () => 'b64u',
  setEnvironment: vi.fn(),
  getNodeUrl: () => 'https://cn-api.sg.testnet.t3n.terminal3.io',
  loadWasmComponent: vi.fn(),
  createEthAuthInput: vi.fn(),
  eth_get_address: vi.fn(() => '0xabc'),
  metamask_sign: vi.fn(),
  T3nClient: class {},
  DelegationCustodialClient: class {},
  revokeDelegation: vi.fn(),
}));

import { newAgentIdentity, invoke } from '../t3n-real';

const ZERO_KEY = '0x' + '00'.repeat(31) + '01';

const makeInvoke = (executeAndDecode: ReturnType<typeof vi.fn>) =>
  invoke({
    agent: { client: { executeAndDecode } as never, did: 'did:t3n:org', address: '0xabc' },
    agentSecret: ZERO_KEY,
    grant: {
      vcId: new Uint8Array([9]),
      vcIdB64u: 'vc',
      credentialJcs: new Uint8Array([1]),
      credentialJcsB64u: 'cj',
      userSig: new Uint8Array([2]),
      functions: ['compute-payroll'],
      notAfterSecs: 0,
    },
    functionName: 'compute-payroll',
    scriptVersion: '5.1.4',
    request: {
      org_id: 'did:t3n:org',
      cycle_id: 'c',
      pay_period_start: 'a',
      pay_period_end: 'b',
      batch_cap_cents: 5000000n,
    },
  });

const nodeError = (detail: string, requestId = 'req-x') =>
  new Error(`HTTP 400: Invalid params ({"code":"bad_request","detail":${JSON.stringify(detail)},"request_id":"${requestId}"})`);

describe('newAgentIdentity', () => {
  it('derives a 33-byte compressed pubkey from a given key', () => {
    const id = newAgentIdentity(ZERO_KEY);
    expect(id.privateKey).toBe(ZERO_KEY);
    expect(id.pubkey).toHaveLength(33);
  });

  it('generates a random identity when no key is given', () => {
    const a = newAgentIdentity();
    const b = newAgentIdentity();
    expect(a.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});

describe('invoke verdict classification', () => {
  it('allows when the contract accepts the call', async () => {
    const v = await makeInvoke(vi.fn().mockResolvedValue({ ok: true }));
    expect(v.verdict).toBe('allow');
    expect(v.reason).toContain('authorized');
  });

  it('denies an out-of-scope function (function_not_allowed)', async () => {
    const v = await makeInvoke(
      vi.fn().mockRejectedValue(nodeError('function_not_allowed: not a member of credential.functions'))
    );
    expect(v.verdict).toBe('deny');
    expect(v.reason).toContain('function_not_allowed');
    expect(v.requestId).toBe('req-x');
  });

  it('denies a revoked credential', async () => {
    const v = await makeInvoke(vi.fn().mockRejectedValue(nodeError('credential_revoked: revoked in its entirety')));
    expect(v.verdict).toBe('deny');
  });

  it('denies an expired credential', async () => {
    const v = await makeInvoke(vi.fn().mockRejectedValue(nodeError('Expired: credential is expired')));
    expect(v.verdict).toBe('deny');
  });

  it('treats a downstream business error as authorized (allow + businessNote)', async () => {
    const v = await makeInvoke(
      vi.fn().mockRejectedValue(nodeError('NoGrant: no grant exists for this user on tee:payroll'))
    );
    expect(v.verdict).toBe('allow');
    expect(v.businessNote).toContain('NoGrant');
  });
});
