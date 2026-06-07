import { Database } from './db';

export interface PolicyInput {
  agentDid: string;
  fn: string;
  host?: string;
  amount?: number;
}

export interface PolicyResult {
  verdict: 'allow' | 'deny';
  reason: string;
}

export function evaluatePolicy(db: Database, input: PolicyInput): PolicyResult {
  const { agentDid, fn, host, amount } = input;

  // 1. Identity Check
  const agent = db.agents.find(a => a.did === agentDid);
  if (!agent || !agent.registered) {
    return {
      verdict: 'deny',
      reason: 'unregistered identity'
    };
  }

  // 2. Grant Check
  const grant = db.grants.find(g => g.agentDid === agentDid);
  if (!grant) {
    return {
      verdict: 'deny',
      reason: `no active grant found for agent: ${agent.name}`
    };
  }

  // 3. Function Check
  if (!grant.functions.includes(fn)) {
    return {
      verdict: 'deny',
      reason: `action outside scope: ${agent.name} can't ${fn}`
    };
  }

  // 4. Host (Egress) Check
  if (host) {
    if (!grant.allowedHosts.includes(host)) {
      return {
        verdict: 'deny',
        reason: `host not allowlisted (host/http.egress_denied)`
      };
    }
  }

  // 5. Amount/Limit Check (specific to transfers)
  if (fn === 'transfer' && amount !== undefined) {
    const limit = 1000; // Hardcoded $1k limit for payments
    if (amount > limit) {
      return {
        verdict: 'deny',
        reason: `exceeds scope: $${amount} > $1k limit; dest not allowlisted`
      };
    }
  }

  return {
    verdict: 'allow',
    reason: 'authorized'
  };
}
