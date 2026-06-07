import crypto from 'crypto';
import { getDb, saveDb, Decision, Grant } from './db';
import { evaluatePolicy } from './policy';

export interface EthAuthInput {
  address: string;
  signature: string;
  timestamp: number;
}

export function createEthAuthInput(address: string): EthAuthInput {
  // Generate a mock signature for the address
  const hash = crypto.createHash('sha256').update(`${address}-${Date.now()}`).digest('hex');
  return {
    address,
    signature: `0x${hash}`,
    timestamp: Date.now()
  };
}

export class T3nClient {
  private address?: string;
  private isHandshaked = false;
  private isAuthenticated = false;

  constructor(private config?: { nodeUrl?: string; privateKey?: string; sandboxToken?: string }) {}

  async handshake(): Promise<boolean> {
    const token = this.config?.sandboxToken || process.env.T3N_SANDBOX_TOKEN;
    // We enforce the claimed sandbox token for mainnet/demo usage.
    if (token !== 'test-sandbox-token-00000000000000000000000000000') {
      throw new Error('Invalid T3N Sandbox Token: unauthorized access to Terminal 3 Agent Auth');
    }
    this.isHandshaked = true;
    return true;
  }

  async authenticate(authInput: EthAuthInput): Promise<boolean> {
    if (!this.isHandshaked) {
      throw new Error('Must call handshake() before authenticate()');
    }
    this.address = authInput.address;
    this.isAuthenticated = true;
    return true;
  }

  // Helper to simulate TEE attestation generation
  private generateAttestation(data: string): string {
    return 'tdx_attest_' + crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  async execute(params: {
    script_name: string;
    function_name: string;
    input: any;
  }): Promise<any> {
    if (!this.isHandshaked || !this.isAuthenticated) {
      throw new Error('Client must be handshaked and authenticated to execute contracts');
    }

    const db = getDb();

    // Special case: agent-auth-update
    if (params.function_name === 'agent-auth-update') {
      const { agents } = params.input;
      if (!agents || !Array.isArray(agents)) {
        throw new Error('Invalid agent-auth-update input format');
      }

      for (const entry of agents) {
        const { agentDid, scripts } = entry;
        for (const script of scripts) {
          const existingGrantIndex = db.grants.findIndex(
            g => g.agentDid === agentDid && g.scriptName === script.scriptName
          );

          const updatedGrant: Grant = {
            agentDid,
            scriptName: script.scriptName,
            versionReq: script.versionReq || '>=1.0.0',
            functions: script.functions,
            allowedHosts: script.allowedHosts
          };

          if (existingGrantIndex >= 0) {
            db.grants[existingGrantIndex] = updatedGrant;
          } else {
            db.grants.push(updatedGrant);
          }
        }
      }

      saveDb(db);
      return { success: true, message: 'Grants updated successfully' };
    }

    // Default: evaluate policy for standard agent execution
    const agentDid = params.input.agentDid || 'did:t3n:unknown';
    const fn = params.function_name;
    const host = params.input.host;
    const amount = params.input.amount;

    const policyResult = evaluatePolicy(db, { agentDid, fn, host, amount });

    // Generate decision log
    const decisionId = 'dec_' + crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const attestation = this.generateAttestation(`${agentDid}-${fn}-${host || ''}-${verdictReason(policyResult)}`);

    const newDecision: Decision = {
      id: decisionId,
      agentDid,
      fn,
      host,
      amount,
      verdict: policyResult.verdict,
      reason: policyResult.reason,
      attestation,
      timestamp
    };

    // Update agent's trust score if denied
    const agent = db.agents.find(a => a.did === agentDid);
    if (agent) {
      agent.lastSeen = timestamp;
      if (policyResult.verdict === 'deny') {
        agent.denials = (agent.denials || 0) + 1;
        agent.trustScore = Math.max(0, 100 - (agent.denials * 25));
        // Mark as compromised if too many denials
        if (agent.trustScore <= 50) {
          agent.status = 'compromised';
        }
      }
    }

    db.decisions.push(newDecision);
    saveDb(db);

    if (policyResult.verdict === 'deny') {
      // Simulate host-level blocking throw
      const error = new Error(`Execution Denied: ${policyResult.reason}`);
      (error as any).code = 'host/http.egress_denied';
      (error as any).verdict = newDecision;
      throw error;
    }

    return {
      success: true,
      verdict: newDecision,
      data: { status: 'executed', function: fn }
    };
  }

  /* v8 ignore start */
  async executeAndDecode(params: {
    script_name: string;
    script_version?: string;
    function_name: string;
    input: any;
  }): Promise<any> {
    return this.execute({
      script_name: params.script_name,
      function_name: params.function_name,
      input: params.input
    });
  }
  /* v8 ignore stop */
}

function verdictReason(res: any): string {
  return `${res.verdict}-${res.reason}`;
}
