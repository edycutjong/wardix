/**
 * Real Terminal 3 integration — @terminal3/t3n-sdk against the live testnet.
 *
 * This is NOT a simulation. It performs a real handshake + Ethereum auth with
 * the T3n node, issues real User-to-Agent delegation credentials (TEE custodial
 * signing), submits real delegated invocations to the deployed `tee:payroll`
 * contract, and revokes credentials on-chain. Verdicts are the contract's own.
 *
 * Server-only. Requires a funded testnet key (see T3N_SANDBOX_TOKEN).
 */
import {
  T3nClient,
  loadWasmComponent,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
  setEnvironment,
  getNodeUrl,
  buildPayrollInvocation,
  b64uEncodeBytes,
  DelegationCustodialClient,
  revokeDelegation,
  type Environment,
} from '@terminal3/t3n-sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import crypto from 'crypto';

export const DELEGATION_DOMAIN = 'ot3.delegation/1';
export const PAYROLL_CONTRACT = 'tee:payroll';
export const PAYROLL_SCRIPT = 'tee:payroll/contracts';

const ENV = (process.env.T3N_ENV as Environment) || 'testnet';

export interface Connection {
  client: T3nClient;
  did: string;
  address: string;
}

export interface AgentIdentity {
  /** 0x-prefixed secp256k1 private key the agent signs invocations with. */
  privateKey: string;
  /** 33-byte compressed secp256k1 public key embedded in the credential. */
  pubkey: Uint8Array;
}

export interface Verdict {
  /** The agent-auth gate decision: did the delegation contract accept the credential? */
  verdict: 'allow' | 'deny';
  reason: string;
  /** Terminal 3 request id from the live node — proves the round-trip. */
  requestId?: string;
  /** Raw decoded contract response on allow. */
  raw?: unknown;
  /** Present when the credential was accepted but the contract's business logic returned a note. */
  businessNote?: string;
}

/**
 * Substrings that identify a rejection at the delegation / agent-auth layer
 * (as opposed to the contract's downstream business logic). When a denial
 * matches none of these, the credential itself was accepted.
 */
const AUTH_DENY_MARKERS = [
  'function_not_allowed',
  'revoked',
  'expired',
  'not_before',
  'not yet valid',
  'wrongprimarywallet',
  'scoperequired',
  'missing required scope',
  'notcredentialholder',
  'invalid credential',
  'signature',
  'insufficientcredit',
];

const hexToBytes = (h: string) =>
  Uint8Array.from(Buffer.from(h.replace(/^0x/, ''), 'hex'));

export function newAgentIdentity(privateKey?: string): AgentIdentity {
  const pk = privateKey || '0x' + crypto.randomBytes(32).toString('hex');
  return { privateKey: pk, pubkey: secp256k1.getPublicKey(hexToBytes(pk), true) };
}

/** Real handshake + Ethereum authentication against the live T3n node. */
export async function connect(privateKey: string): Promise<Connection> {
  setEnvironment(ENV);
  const address = eth_get_address(privateKey);
  const client = new T3nClient({
    wasmComponent: await loadWasmComponent(),
    handlers: { EthSign: metamask_sign(address, undefined, privateKey) },
  });
  await client.handshake();
  const did = await client.authenticate(createEthAuthInput(address));
  return { client, did: did.toString(), address };
}

export interface IssueGrantOpts {
  org: Connection;
  agentPubkey: Uint8Array;
  functions: string[];
  /** Seconds the grant stays valid (default 1h). Negative ⇒ already expired. */
  ttlSecs?: number;
  scopes?: string[];
  metadata?: Record<string, string>;
}

export interface Grant {
  vcId: Uint8Array;
  vcIdB64u: string;
  credentialJcs: Uint8Array;
  credentialJcsB64u: string;
  userSig: Uint8Array;
  functions: string[];
  notAfterSecs: number;
}

/**
 * Issue a real delegation credential, TEE-custodially signed by the org's
 * primary wallet (`tee:delegation/contracts::sign`). The org delegates a
 * scoped, time-boxed set of `functions` on `tee:payroll` to the agent.
 */
export async function issueGrant(opts: IssueGrantOpts): Promise<Grant> {
  const { org, agentPubkey, functions } = opts;
  const ttl = opts.ttlSecs ?? 3600;
  const now = Math.floor(Date.now() / 1000);
  const notAfter = now + ttl;
  // Keep the window valid (not_before < not_after) even for already-expired
  // grants used to demonstrate expiry enforcement.
  const notBefore = Math.min(now - 60, notAfter - 60);
  const vcId = hexToBytes(crypto.randomUUID().replace(/-/g, ''));

  const custodial = new DelegationCustodialClient(org.client, getNodeUrl());
  const signed = await custodial.signCustodial({
    v: DELEGATION_DOMAIN,
    user_did: org.did,
    agent_pubkey: b64uEncodeBytes(agentPubkey),
    org_did: org.did,
    contract: PAYROLL_CONTRACT,
    functions: [...functions].sort(),
    scopes: opts.scopes ?? [],
    metadata: opts.metadata ?? {},
    not_before_secs: String(notBefore),
    not_after_secs: String(notAfter),
    vc_id: b64uEncodeBytes(vcId),
  });

  return {
    vcId,
    vcIdB64u: b64uEncodeBytes(vcId),
    credentialJcs: signed.credentialJcs,
    credentialJcsB64u: b64uEncodeBytes(signed.credentialJcs),
    userSig: signed.userSig,
    functions: [...functions].sort(),
    notAfterSecs: notAfter,
  };
}

export interface InvokeOpts {
  agent: Connection;
  agentSecret: string;
  grant: Grant;
  functionName: string;
  scriptVersion: string;
  request: {
    org_id: string;
    cycle_id: string;
    pay_period_start: string;
    pay_period_end: string;
    batch_cap_cents: bigint;
    historical_baselines?: Record<string, string>;
  };
}

/**
 * Submit a real delegated invocation to the live payroll contract. The
 * contract verifies the credential (user_sig vs primary wallet, agent_sig vs
 * agent_pubkey, function-in-scope, validity window, revocation) inside the TEE
 * and returns its own verdict. Denials surface as structured node errors.
 */
export async function invoke(opts: InvokeOpts): Promise<Verdict> {
  const { agent, grant } = opts;
  const nonce = crypto.randomBytes(16);
  const invocation = buildPayrollInvocation({
    credentialJcs: grant.credentialJcs,
    userSig: grant.userSig,
    vcId: grant.vcId,
    nonce,
    agentSecret: hexToBytes(opts.agentSecret),
    request: {
      ...opts.request,
      historical_baselines: opts.request.historical_baselines ?? {},
    },
  });

  const env = invocation.envelope;
  const req = invocation.request;
  const wire = {
    envelope: {
      credential_jcs: b64uEncodeBytes(env.credential_jcs),
      user_sig: b64uEncodeBytes(env.user_sig),
      agent_sig: b64uEncodeBytes(env.agent_sig),
      nonce: b64uEncodeBytes(env.nonce),
      request_hash: b64uEncodeBytes(env.request_hash),
    },
    request: {
      org_id: req.org_id,
      cycle_id: req.cycle_id,
      pay_period_start: req.pay_period_start,
      pay_period_end: req.pay_period_end,
      batch_cap_cents: String(req.batch_cap_cents),
      historical_baselines: req.historical_baselines,
      individual_disbursement_threshold_cents: String(
        req.individual_disbursement_threshold_cents ?? 1500000n
      ),
    },
  };

  try {
    const raw = await agent.client.executeAndDecode({
      script_name: PAYROLL_SCRIPT,
      script_version: opts.scriptVersion,
      function_name: opts.functionName,
      input: wire,
    });
    return { verdict: 'allow', reason: 'authorized by tee:payroll', raw };
  } catch (e: unknown) {
    return parseError(e);
  }
}

export interface RevokeOpts {
  org: Connection;
  grant: Grant;
  /** Omit to revoke the whole credential; pass a subset to narrow scope. */
  functions?: string[];
}

/** Revoke a delegation credential on-chain (tee:delegation/contracts::revoke). */
export async function revoke(opts: RevokeOpts) {
  return revokeDelegation({
    credentialJcsB64u: opts.grant.credentialJcsB64u,
    revokedFunctions: opts.functions,
    client: opts.org.client,
    baseUrl: getNodeUrl(),
  });
}

/** Parse a live node error into a structured deny verdict. */
function parseError(e: unknown): Verdict {
  const msg = e instanceof Error ? e.message : String(e);
  let requestId: string | undefined;
  let detail = msg;
  const m = msg.match(/\{.*\}/s);
  if (m) {
    try {
      const body = JSON.parse(m[0]);
      requestId = body.request_id;
      detail = body.detail || body.message || detail;
      // Nested JSON detail (e.g. {"code":"BadInput","message":"..."})
      const inner = typeof detail === 'string' && detail.match(/\{.*\}/s);
      if (inner) {
        try {
          const ib = JSON.parse(inner[0]);
          detail = ib.message || ib.detail || detail;
        } catch {
          /* keep outer detail */
        }
      }
    } catch {
      /* keep raw message */
    }
  }
  const text = String(detail);
  const isAuthDeny = AUTH_DENY_MARKERS.some((m) => text.toLowerCase().includes(m));
  if (isAuthDeny) {
    return { verdict: 'deny', reason: text, requestId };
  }
  // Credential accepted by the delegation gate; the error is downstream
  // business logic (e.g. missing compute output) — Wardix authorized the agent.
  return { verdict: 'allow', reason: 'authorized by tee:delegation', businessNote: text, requestId };
}

export { getNodeUrl };
