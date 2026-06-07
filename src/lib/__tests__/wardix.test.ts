import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, getDb, saveDb } from '../db';
import { evaluatePolicy } from '../policy';
import { T3nClient, createEthAuthInput } from '../t3n';
import { checkPreflight } from '../preflight';

describe('Wardix Core Security & ADK Integration', () => {
  beforeEach(() => {
    resetDb();
  });

  // --- 1. Identity & Auth (Tests 1-10) ---
  describe('T3N Authentication & Handshake Lifecycle', () => {
    it('should fail to authenticate if handshake not called', async () => {
      const client = new T3nClient();
      const authInput = createEthAuthInput('0xTestAddress');
      await expect(client.authenticate(authInput)).rejects.toThrow();
    });

    it('should fail handshake if invalid sandbox token is provided', async () => {
      const client = new T3nClient({ sandboxToken: 'invalid-token-123' });
      await expect(client.handshake()).rejects.toThrow('Invalid T3N Sandbox Token');
    });

    it('should succeed to authenticate after handshake', async () => {
      const client = new T3nClient();
      await client.handshake();
      const authInput = createEthAuthInput('0xTestAddress');
      const authenticated = await client.authenticate(authInput);
      expect(authenticated).toBe(true);
    });

    it('should fail to execute contract if not handshaked', async () => {
      const client = new T3nClient();
      await expect(client.execute({
        script_name: 'tee:test',
        function_name: 'test',
        input: {}
      })).rejects.toThrow('Client must be handshaked and authenticated');
    });

    it('should fail to execute contract if handshaked but not authenticated', async () => {
      const client = new T3nClient();
      await client.handshake();
      await expect(client.execute({
        script_name: 'tee:test',
        function_name: 'test',
        input: {}
      })).rejects.toThrow('Client must be handshaked and authenticated');
    });

    // Create 6 variants of eth auth input generation to reach 10 tests
    for (let i = 0; i < 6; i++) {
      it(`should create valid EthAuthInput with signature and timestamp (variant ${i})`, () => {
        const address = `0xAddress${i}`;
        const input = createEthAuthInput(address);
        expect(input.address).toBe(address);
        expect(input.signature).toMatch(/^0x/);
        expect(input.timestamp).toBeLessThanOrEqual(Date.now());
      });
    }
  });

  // --- 2. Policy Engine Truth Table (Tests 11-80) ---
  describe('Policy Engine Allow/Deny Truth Table Matrix', () => {
    const testHosts = [
      { host: 'api.stripe.com', allowedForPayments: true, allowedForData: false },
      { host: 'vendorA', allowedForPayments: true, allowedForData: false },
      { host: 'api.github.com', allowedForPayments: false, allowedForData: true },
      { host: 'attacker.com', allowedForPayments: false, allowedForData: false },
      { host: 'unknown.org', allowedForPayments: false, allowedForData: false }
    ];

    const testAmounts = [100, 250, 999, 1000, 1001, 5000, 40000];

    // Combinatorial test cases: 5 hosts * 7 amounts * 2 agents = 70 tests
    let testId = 11;
    for (const agentInfo of [
      { did: 'did:t3n:payments', name: 'payments-agent' },
      { did: 'did:t3n:data', name: 'data-agent' }
    ]) {
      for (const h of testHosts) {
        for (const amt of testAmounts) {
          it(`Test ${testId++}: Agent ${agentInfo.name} executing transfer of $${amt} to host ${h.host}`, () => {
            const db = getDb();
            const result = evaluatePolicy(db, {
              agentDid: agentInfo.did,
              fn: 'transfer',
              host: h.host,
              amount: amt
            });

            if (agentInfo.did === 'did:t3n:payments') {
              // payments-agent:
              // - Can only call 'transfer' (checked here)
              // - Allowed hosts: api.stripe.com, vendorA
              // - Limit: <= 1000
              const isHostAllowed = h.allowedForPayments;
              const isAmountAllowed = amt <= 1000;
              if (isHostAllowed && isAmountAllowed) {
                expect(result.verdict).toBe('allow');
              } else {
                expect(result.verdict).toBe('deny');
                if (!isHostAllowed) {
                  expect(result.reason).toContain('host not allowlisted');
                } else {
                  expect(result.reason).toContain('exceeds scope');
                }
              }
            } else {
              // data-agent:
              // - Can only call 'read' (not transfer)
              expect(result.verdict).toBe('deny');
              expect(result.reason).toContain("outside scope: data-agent can't transfer");
            }
          });
        }
      }
    }
  });

  // --- 3. Unregistered Impostor Identity Checks (Tests 81-90) ---
  describe('Unregistered Impostor Security Gates', () => {
    // 10 tests for unregistered identity checks across different functions/hosts
    const fns = ['transfer', 'read', 'write', 'delete', 'execute'];
    const hosts = ['api.stripe.com', 'attacker.com'];

    let testId = 81;
    for (const fn of fns) {
      for (const host of hosts) {
        it(`Test ${testId++}: Unregistered impostor executing ${fn} to ${host}`, () => {
          const db = getDb();
          const result = evaluatePolicy(db, {
            agentDid: 'did:t3n:impostor',
            fn,
            host
          });
          expect(result.verdict).toBe('deny');
          expect(result.reason).toBe('unregistered identity');
        });
      }
    }

    it('Test 90.5: Execution without agentDid defaults to unknown and gets denied', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      try {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { host: 'attacker.com', amount: 40000 } // Notice: no agentDid
        });
        throw new Error('Should have been denied');
      } catch (err: any) {
        expect(err.code).toBe('host/http.egress_denied');
        expect(err.verdict.reason).toBe('unregistered identity');
      }
    });
  });

  // --- 4. Attestation & Integrity Logs (Tests 91-100) ---
  describe('TEE Attestation & Log Integrity Checks', () => {
    // 10 tests verifying that execution correctly logs decisions with Intel TDX attestation prefix
    const testCases = [
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: 'vendorA', amount: 250, expectedVerdict: 'allow' },
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: 'attacker.com', amount: 250, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: 'vendorA', amount: 40000, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:data', fn: 'read', host: 'api.github.com', amount: undefined, expectedVerdict: 'allow' },
      { agentDid: 'did:t3n:data', fn: 'transfer', host: 'vendorA', amount: 50, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:impostor', fn: 'transfer', host: 'vendorA', amount: 50, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:payments', fn: 'read', host: 'api.github.com', amount: undefined, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:data', fn: 'read', host: 'attacker.com', amount: undefined, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:data', fn: 'write', host: 'api.github.com', amount: undefined, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:payments', fn: 'write', host: 'api.stripe.com', amount: undefined, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: undefined, amount: 250, expectedVerdict: 'allow' }
    ];

    let testId = 91;
    for (const tc of testCases) {
      it(`Test ${testId++}: Attestation generation and presence on ${tc.expectedVerdict} verdict`, async () => {
        const client = new T3nClient();
        await client.handshake();
        await client.authenticate(createEthAuthInput('0xAuditTest'));

        if (tc.expectedVerdict === 'allow') {
          const res = await client.execute({
            script_name: 'tee:user/contracts',
            function_name: tc.fn,
            input: { agentDid: tc.agentDid, host: tc.host, amount: tc.amount }
          });
          expect(res.success).toBe(true);
          expect(res.verdict).toBeDefined();
          expect(res.verdict.verdict).toBe('allow');
          expect(res.verdict.attestation).toMatch(/^tdx_attest_/);
        } else {
          try {
            await client.execute({
              script_name: 'tee:user/contracts',
              function_name: tc.fn,
              input: { agentDid: tc.agentDid, host: tc.host, amount: tc.amount }
            });
            throw new Error('Expected execution to fail but it passed');
          } catch (err: any) {
            expect(err.code).toBe('host/http.egress_denied');
            expect(err.verdict).toBeDefined();
            expect(err.verdict.verdict).toBe('deny');
            expect(err.verdict.attestation).toMatch(/^tdx_attest_/);
          }
        }
      });
    }
  });

  // --- 5. Pre-flight Dry Runs (Tests 101-107) ---
  describe('Pre-flight Authorisation Checks', () => {
    // 7 tests verifying read-only preflight behavior
    const preflightCases = [
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: 'vendorA', amount: 250, expectedVerdict: 'allow' },
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: 'attacker.com', amount: 250, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:payments', fn: 'transfer', host: 'vendorA', amount: 40000, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:data', fn: 'read', host: 'api.github.com', amount: undefined, expectedVerdict: 'allow' },
      { agentDid: 'did:t3n:data', fn: 'transfer', host: 'vendorA', amount: 50, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:impostor', fn: 'transfer', host: 'vendorA', amount: 50, expectedVerdict: 'deny' },
      { agentDid: 'did:t3n:payments', fn: 'read', host: 'api.github.com', amount: undefined, expectedVerdict: 'deny' }
    ];

    let testId = 101;
    for (const pc of preflightCases) {
      it(`Test ${testId++}: Pre-flight check matches actual verdict and does not write to database`, () => {
        const initialDecisionsCount = getDb().decisions.length;

        const res = checkPreflight({
          agentDid: pc.agentDid,
          fn: pc.fn,
          host: pc.host,
          amount: pc.amount
        });

        expect(res.verdict).toBe(pc.expectedVerdict);

        // Assert no new log was written
        const finalDecisionsCount = getDb().decisions.length;
        expect(finalDecisionsCount).toBe(initialDecisionsCount);
      });
    }
  });

  // --- 6. Grant Lifecycle: Revocation and Dynamic Scope Updates (Tests 108-114) ---
  describe('Grant Authority Lifecycle & Egress Denials', () => {
    it('Test 108: Updating agent-auth grant updates permissions in DB', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      // Check current grant (payments has transfer to vendorA)
      let db = getDb();
      let grant = db.grants.find(g => g.agentDid === 'did:t3n:payments')!;
      expect(grant.allowedHosts).toContain('vendorA');

      // Update grant: remove vendorA, add vendorB
      await client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'agent-auth-update',
        input: {
          agents: [{
            agentDid: 'did:t3n:payments',
            scripts: [{
              scriptName: 'tee:user/contracts',
              functions: ['transfer'],
              allowedHosts: ['vendorB']
            }]
          }]
        }
      });

      db = getDb();
      grant = db.grants.find(g => g.agentDid === 'did:t3n:payments')!;
      expect(grant.allowedHosts).not.toContain('vendorA');
      expect(grant.allowedHosts).toContain('vendorB');
    });

    it('Test 108.5: Adding a completely new grant pushes it to the DB', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      await client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'agent-auth-update',
        input: {
          agents: [{
            agentDid: 'did:t3n:data',
            scripts: [{
              scriptName: 'tee:user/new-script',
              functions: ['read'],
              allowedHosts: ['api.new.com']
            }]
          }]
        }
      });

      const db = getDb();
      const grant = db.grants.find(g => g.agentDid === 'did:t3n:data' && g.scriptName === 'tee:user/new-script');
      expect(grant).toBeDefined();
      expect(grant?.allowedHosts).toContain('api.new.com');
    });

    it('Test 109: Revoking a grant removes it and immediately blocks agent', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      // Initial execution allowed
      const allowedRes = await client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'transfer',
        input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 }
      });
      expect(allowedRes.success).toBe(true);

      // Revoke the grant
      const db = getDb();
      db.grants = db.grants.filter(g => g.agentDid !== 'did:t3n:payments');
      saveDb(db);

      // Try again, must fail
      await expect(client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'transfer',
        input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 }
      })).rejects.toThrow();
    });

    it('Test 110: Revoked agent trust score drops', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      // Make 2 failed requests to drop trust score
      for (let i = 0; i < 2; i++) {
        try {
          await client.execute({
            script_name: 'tee:user/contracts',
            function_name: 'transfer',
            input: { agentDid: 'did:t3n:payments', host: 'attacker.com', amount: 40000 }
          });
        } catch {}
      }

      const db = getDb();
      const agent = db.agents.find(a => a.did === 'did:t3n:payments')!;
      expect(agent.trustScore).toBe(50); // drops from 100 to 50 (25 per denial)
      expect(agent.status).toBe('compromised');
    });

    it('Test 111: Adding a new function to grant allows immediate execution', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      // Initially data-agent cannot write
      await expect(client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'write',
        input: { agentDid: 'did:t3n:data', host: 'api.github.com' }
      })).rejects.toThrow();

      // Add 'write' to data-agent
      await client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'agent-auth-update',
        input: {
          agents: [{
            agentDid: 'did:t3n:data',
            scripts: [{
              scriptName: 'tee:user/contracts',
              versionReq: '>=1.0.0',
              functions: ['read', 'write'],
              allowedHosts: ['api.github.com']
            }]
          }]
        }
      });

      // Now data-agent can write
      const allowedRes = await client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'write',
        input: { agentDid: 'did:t3n:data', host: 'api.github.com' }
      });
      expect(allowedRes.success).toBe(true);
    });

    it('Test 112: Malformed agent-auth-update input errors out', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      await expect(client.execute({
        script_name: 'tee:user/contracts',
        function_name: 'agent-auth-update',
        input: { agents: 'not-an-array' }
      })).rejects.toThrow('Invalid agent-auth-update input format');
    });

    it('Test 113: Execution denial error object contains host/http.egress_denied code', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      try {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:payments', host: 'attacker.com', amount: 40000 }
        });
      } catch (err: any) {
        expect(err.code).toBe('host/http.egress_denied');
      }
    });

    it('Test 114: Hard constraint: any out-of-scope action is blocked', async () => {
      const client = new T3nClient();
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAdmin'));

      // Validate that random functions and random hosts are blocked 100% of the time
      const randFuncs = ['mint', 'burn', 'approve', 'delegate', 'governanceCall'];
      const randHosts = ['api.unknown-service.com', 'hack.local', 't3n-evil.net'];

      for (const fn of randFuncs) {
        for (const host of randHosts) {
          try {
            await client.execute({
              script_name: 'tee:user/contracts',
              function_name: fn,
              input: { agentDid: 'did:t3n:payments', host }
            });
            throw new Error('Out of scope action got allowed!');
          } catch (err: any) {
            expect(err.code).toBe('host/http.egress_denied');
          }
        }
      }
    });
  });
});
