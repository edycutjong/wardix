import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the real adapter so the route is tested in isolation (no network).
const connect = vi.fn();
const newAgentIdentity = vi.fn();
const issueGrant = vi.fn();
const invoke = vi.fn();
const revoke = vi.fn();
const getNodeUrl = vi.fn(() => 'https://cn-api.sg.testnet.t3n.terminal3.io');

vi.mock('@/lib/t3n-real', () => ({
  connect: (...a: unknown[]) => connect(...a),
  newAgentIdentity: (...a: unknown[]) => newAgentIdentity(...a),
  issueGrant: (...a: unknown[]) => issueGrant(...a),
  invoke: (...a: unknown[]) => invoke(...a),
  revoke: (...a: unknown[]) => revoke(...a),
  getNodeUrl: () => getNodeUrl(),
}));

import { POST } from '../verify/route';

const req = (body: unknown) =>
  new Request('http://localhost/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('/api/verify route', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({ did: 'did:t3n:org', client: {} });
    newAgentIdentity.mockReturnValue({ privateKey: '0xabc', pubkey: new Uint8Array(33) });
    issueGrant.mockResolvedValue({ functions: ['compute-payroll'], vcIdB64u: 'vc' });
    invoke.mockResolvedValue({ verdict: 'allow', reason: 'authorized by tee:delegation', requestId: 'req-1' });
    revoke.mockResolvedValue({ vcId: 'vc', revokedFunctions: null });
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns 503 when live mode is disabled', async () => {
    process.env.T3N_LIVE = '0';
    const res = await POST(req({ functions: ['compute-payroll'], call: 'compute-payroll' }));
    expect(res.status).toBe(503);
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 503 when token is missing in live mode', async () => {
    process.env.T3N_LIVE = '1';
    delete process.env.T3N_SANDBOX_TOKEN;
    const res = await POST(req({ functions: ['compute-payroll'], call: 'compute-payroll' }));
    expect(res.status).toBe(503);
  });

  it('returns 400 on malformed input', async () => {
    process.env.T3N_LIVE = '1';
    process.env.T3N_SANDBOX_TOKEN = '0xkey';
    const res = await POST(req({ functions: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('runs the real flow and returns the verdict on the happy path', async () => {
    process.env.T3N_LIVE = '1';
    process.env.T3N_SANDBOX_TOKEN = '0xkey';
    const res = await POST(req({ functions: ['compute-payroll'], call: 'compute-payroll' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict).toBe('allow');
    expect(body.requestId).toBe('req-1');
    expect(body.node).toContain('testnet');
    expect(connect).toHaveBeenCalledOnce();
    expect(issueGrant).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('revokes before invoking when revoke=true', async () => {
    process.env.T3N_LIVE = '1';
    process.env.T3N_SANDBOX_TOKEN = '0xkey';
    invoke.mockResolvedValue({ verdict: 'deny', reason: 'credential_revoked', requestId: 'req-2' });
    const res = await POST(req({ functions: ['compute-payroll'], call: 'compute-payroll', revoke: true }));
    const body = await res.json();
    expect(revoke).toHaveBeenCalledOnce();
    expect(body.verdict).toBe('deny');
    expect(body.revoked).toBe(true);
  });

  it('returns 500 when the adapter throws', async () => {
    process.env.T3N_LIVE = '1';
    process.env.T3N_SANDBOX_TOKEN = '0xkey';
    connect.mockRejectedValue(new Error('node unreachable'));
    const res = await POST(req({ functions: ['compute-payroll'], call: 'compute-payroll' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('node unreachable');
  });
});
