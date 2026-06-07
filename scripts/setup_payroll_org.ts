/**
 * Full payroll onboarding for a clean, fully-disbursing ALLOW (org ≠ agent).
 *
 * Steps:
 *   1. Org grants the agent a contract grant on tee:payroll (clears NoGrant)
 *   2. Org allows itself to write the payroll/employees scope
 *   3. Org writes an EmployeeRecord
 *   4. Org issues a scoped delegation credential to the agent
 *   5. Agent runs compute-payroll under the delegation
 *   6. Agent runs execute-disbursement
 *
 * Requires two funded testnet keys: T3N_ORG_KEY and T3N_AGENT_KEY.
 *
 * STATUS (verified on testnet, see BUGS.md #9): steps 1-3 are blocked by
 * `OrganisationNotFound` / `OrgPolicyNotInitialised`. The org-data contract
 * needs an *organisation* entity that is distinct from a dev tenant and has no
 * creation path in the public SDK (orgs are seeded "by the organisation
 * contract", which isn't exposed). `submitUserInput({becomeDevTenant:true})`
 * only registers a *tenant*, not an organisation. So a fully-disbursing run
 * cannot complete from a sandbox dev tenant today. The delegation/agent-auth
 * layer (steps 5-6 verdicts) is fully real regardless — that is Wardix's
 * product. This script is the exact onboarding sequence for the day org
 * provisioning becomes available.
 */
import {
  OrgDataClient,
  getNodeUrl,
  setEnvironment,
} from '@terminal3/t3n-sdk';
import {
  connect,
  newAgentIdentity,
  issueGrant,
  invoke,
  type Verdict,
} from '../src/lib/t3n-real';

const VERSION = process.env.T3N_PAYROLL_VERSION || '5.1.4';
const SCOPE = 'payroll/employees';
const hexToBytes = (h: string) => Uint8Array.from(Buffer.from(h.replace(/^0x/, ''), 'hex'));

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

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  process.stdout.write(`\n• ${label} ... `);
  try {
    const r = await fn();
    console.log('OK', r ? JSON.stringify(r).slice(0, 200) : '');
    return r;
  } catch (e: unknown) {
    console.log('ERR:', e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

async function main() {
  setEnvironment((process.env.T3N_ENV as 'testnet' | 'production') || 'testnet');
  const orgKey = process.env.T3N_ORG_KEY;
  const agentKey = process.env.T3N_AGENT_KEY;
  if (!orgKey || !agentKey) throw new Error('Set T3N_ORG_KEY and T3N_AGENT_KEY (two funded keys).');

  console.log('Node:', getNodeUrl());
  const org = await connect(orgKey);
  const agent = await connect(agentKey);
  const agentId = newAgentIdentity(agentKey);
  console.log('Org DID:  ', org.did);
  console.log('Agent DID:', agent.did);

  const orgData = new OrgDataClient(getNodeUrl(), hexToBytes(orgKey), org.did);

  // 0. Initialise the org-data policy (org is its own admin)
  await step('createPolicy(org admin)', () =>
    orgData.createPolicy({ orgDid: org.did, initialAdminDid: org.did })
  );

  // 1. Contract grant on tee:payroll for the agent (clears NoGrant)
  await step('setGrants(tee:payroll → agent)', () =>
    orgData.setGrants({
      orgDid: org.did,
      contractId: 'tee:payroll',
      grants: [
        {
          user_did: agent.did,
          functions: ['compute-payroll', 'execute-disbursement'],
          scopes: [SCOPE],
          constraints: {},
          expires_at_secs: null,
        },
      ],
    })
  );

  // 2. Writers for the employees scope
  await step('setWriters(payroll/employees → org)', () =>
    orgData.setWriters({ orgDid: org.did, scope: SCOPE, writers: [org.did] })
  );

  // 3. Write an employee record
  const emp = {
    employee_id: 'emp-001',
    employment_status: 'Active',
    is_on_probation: false,
    hire_date: '2025-01-01',
    base_salary_cents: 500000,
    unpaid_leave_days: 0,
    working_days_in_period: 22,
    overtime_hours: 0,
    hourly_rate_cents: 0,
    residency: 'Citizen',
    age_band: 'Under35',
    expense_claims: [],
    bank_account_ref: 'test-ref-001',
    bank_account_changed_recently: false,
  };
  await step('writeData(employee emp-001)', () =>
    orgData.writeData({
      orgDid: org.did,
      scope: SCOPE,
      payloadHex: Buffer.from(JSON.stringify(emp)).toString('hex'),
      clientSeqNo: 1,
    })
  );

  // 4. Delegation credential (scoped) to the agent
  const grant = await issueGrant({
    org,
    agentPubkey: agentId.pubkey,
    functions: ['compute-payroll', 'execute-disbursement'],
    scopes: [SCOPE],
  });
  console.log('\n• Delegation credential issued. vc:', grant.vcIdB64u);

  // 5. compute-payroll
  show(
    '5) compute-payroll (delegated)',
    await invoke({
      agent,
      agentSecret: agentId.privateKey,
      grant,
      functionName: 'compute-payroll',
      scriptVersion: VERSION,
      request: baseRequest(org.did),
    })
  );

  // 6. execute-disbursement
  show(
    '6) execute-disbursement (delegated)',
    await invoke({
      agent,
      agentSecret: agentId.privateKey,
      grant,
      functionName: 'execute-disbursement',
      scriptVersion: VERSION,
      request: baseRequest(org.did),
    })
  );
}

main().catch((e) => {
  console.error('SETUP FAILED:', e?.stack || e?.message || e);
  process.exit(1);
});
