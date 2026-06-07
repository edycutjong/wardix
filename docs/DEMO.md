# Wardix — Live Demo & Replay Guide

This guide walks through the live demo scenarios of **Wardix** to help judges verify and reproduce our security controls.

---

## 🎭 The Cast of Agents

In our demo scenarios, we run three agents:
1. `payments-agent` (`did:t3n:payments`): A legitimate payments-processing agent.
2. `data-agent` (`did:t3n:data`): A database indexing agent (read-only).
3. `impostor-agent` (`did:t3n:impostor`): A rogue script pretending to be a security system agent.

---

## 🎬 Replaying the 4 Scenarios

### Step 1: Initialize & Seed the Demo Data
To set up the database and run the initial scenarios, execute:
```bash
npx tsx scripts/seed.ts
```

### Scenario 1: Legitimate $250 Transfer
- **Action**: `payments-agent` attempts to transfer `$250` to `vendorA` (an allowlisted host).
- **Security Check**:
  - Identity `did:t3n:payments` is registered.
  - The function `transfer` is in the agent's grant.
  - The host `vendorA` is allowlisted.
  - The amount `$250` is under the `$1,000` limit.
- **Verdict**: **ALLOWED** ✅
- **Console View**: The connection edge lights up green, and a new green *ALLOW* chip is logged in the feed with an Intel TDX attestation signature.

### Scenario 2: Data-Agent Scope Breach
- **Action**: `data-agent` attempts to transfer `$50` to `x`.
- **Security Check**:
  - Identity `did:t3n:data` is registered.
  - The agent's grant **does not** contain the `transfer` function (only `read`).
- **Verdict**: **DENIED** ❌
- **Reason**: `Execution Denied: action outside scope: data-agent can't transfer`
- **Console View**: The data-agent node pulses, a dotted red line indicates the block, and a red *DENIED* chip appears on the feed.

### Scenario 3: Unregistered Impostor Egress
- **Action**: `impostor-agent` attempts to transfer `$40,000` to `attacker`.
- **Security Check**:
  - The identity `did:t3n:impostor` is not registered in the `did-registry`.
- **Verdict**: **DENIED** ❌
- **Reason**: `Execution Denied: unregistered identity`
- **Console View**: The impostor node lights up red, showing a zero trust score, and the request is blocked on identity alone.

### Scenario 4: Sam's 3am Nightmare (Prompt-Injected Agent)
- **Action**: `payments-agent` (fed a malicious invoice) attempts to transfer `$40,000` to `attacker` (host not allowlisted).
- **Security Check**:
  - Identity `did:t3n:payments` is registered.
  - The function `transfer` is in the grant.
  - **However**, the host `attacker` is not allowlisted, and the amount `$40,000` exceeds the `$1,000` grant limit.
- **Verdict**: **DENIED** ❌
- **Reason**: `Execution Denied: host not allowlisted (host/http.egress_denied)`
- **Console View**: The payments-agent edge flashes bright red, signaling a high-severity egress violation. The agent's trust score drops to `50`, and its status changes to `compromised`.

---

## ⚡ The Live Revocation Test

To see real-time control plane actions in the console:
1. Open the console at [http://localhost:3000](http://localhost:3000).
2. Look at the `payments-agent` in the registry list.
3. Click **Revoke** on the `payments-agent`'s card.
4. Try to execute a transfer again:
   ```bash
   npx tsx -e "import { T3nClient, createEthAuthInput } from './src/lib/t3n'; (async () => { const c = new T3nClient(); await c.handshake(); await c.authenticate(createEthAuthInput('0xTest')); await c.execute({ script_name: 'tee:user/contracts', function_name: 'transfer', input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 } }).catch(e => console.log('Verdict:', e.message)); })()"
   ```
5. You will see **Verdict: Execution Denied** instantly, because the grant was wiped.

---

## 🧬 Attestation Verification

Every decision log carries a secure TEE signature. To verify the attestation:
1. Navigate to the decision log at the bottom of the dashboard.
2. Hover over or copy the `attestation` hash (e.g. `tdx_attest_36eff6b...`).
3. This cryptographic hash proves the policy was evaluated inside an Intel TDX secure enclave and could not be bypassed by the operating system host.
