# SUBMISSION — Wardix

**Title:** Wardix — the control plane for delegated AI agents on Terminal 3.

**Emotional hook (first line):** At 3am, Sam's payroll-running AI agent — fed a poisoned cycle file — tried to push a disbursement it was never authorized to make. It didn't clear, because the grant behind it was scoped, capped, and revocable. Wardix is the control plane that issues, watches, and revokes those grants.

**Short description (≤150 chars):**
> Issue, monitor & revoke scoped AI-agent delegations on Terminal 3. Every verdict is the real tee:delegation contract's — allow, out-of-scope, revoked, expired.

**Long description (~500 words):**
Enterprises are handing real authority to AI agents that run jobs and move money. Terminal 3 already provides the enforcement primitive: **User-to-Agent Delegation Credentials**. A principal (org) signs a credential authorizing a specific agent (by its secp256k1 public key) to call a scoped set of `functions` on a contract — with org-data `scopes`, a spend cap, and a validity window — and the agent then signs each individual invocation. The deployed contract verifies the whole chain *inside an Intel TDX enclave* and runs the action only if every check passes. The gap isn't enforcement; it's **operability**: who did the org delegate, to which agent, for what, until when — and how do you revoke a compromised agent right now and prove it? Wardix answers those.

Wardix is a control plane with its own `did:t3n` identity built directly on `@terminal3/t3n-sdk`. It does four things, all against the live testnet. (1) **Grant** — Wardix issues a real delegation credential via the TEE custodial signer (`tee:delegation/contracts::sign`), scoping the agent's functions and validity. (2) **Pre-flight / invoke** — it submits a real delegated invocation to the deployed `tee:payroll` contract and surfaces the contract's own verdict. (3) **Observe** — it records every allow/deny with the live node's `request_id`, building an audit trail. (4) **Revoke** — `tee:delegation/contracts::revoke` takes effect immediately; the agent's next call is denied.

The demo (`npm run demo:real`) runs four real scenarios against testnet and shows four distinct, contract-issued verdicts:
- **Allow** — an in-scope call under a valid grant is authorized by `tee:delegation`.
- **Deny (out of scope)** — calling a function not in the credential → `function_not_allowed`.
- **Deny (revoked)** — after an on-chain revoke → `credential_revoked`.
- **Deny (expired)** — a lapsed grant → `Expired`.

Each verdict carries a real testnet `request_id`. Nothing is simulated: the handshake, the Ethereum auth, the DID, the credential signature, the agent signature, and the verdict all come from the live node.

This is built for Terminal 3's stated mission — "AI Agent Governance: hardware-attested mandates, so every agentic action is bounded, logged, and provable" — and the buyers it names: banks, institutions, corporates. The agent economy needs a control plane, and Terminal 3's delegation layer is the enforcement it stands on.

**Why ONLY Terminal 3:** Wardix's verdicts are real because enforcement is native and hardware-attested. We use `tee:delegation/contracts` (sign + revoke), `tee:payroll/contracts` (the scoped target), `tee:user/contracts` (TEE-managed wallets/identity), and the SDK's `createEthAuthInput` / custodial signing / `verifyTdxQuote` attestation — inside an Intel TDX enclave. Remove Terminal 3 and you'd need a DID registry, a runtime-enforced per-function/per-credential permission engine with on-chain revocation, a TEE + attestation service, and a custodial signer. *Take Terminal 3 out and the block is advisory, not guaranteed.*

**Honest limitations:** (1) The single-account demo uses one funded testnet tenant acting as both org and agent; a fully separated org≠agent run needs a second funded agent account (the submitter pays credits). (2) The visual console renders a local mirror of issued grants/decisions — there is no host read-back for active credentials (see BUGS.md #1) — while the *verdicts* come from the real contract via `npm run demo:real` and the opt-in `/api/verify` route. (3) The "allow" path authorizes at the delegation layer and then reaches payroll business logic, which needs org/employee setup to fully disburse.

**Demo video script (2–3 min):**
1. (0:00) Sam's 3am page — the unauthorized disbursement near-miss. The human stake.
2. (0:25) The model in 20s: org signs a scoped, capped, time-boxed delegation; agent signs each call; `tee:delegation` verifies in the TEE.
3. (0:50) `npm run demo:real` live: ✅ allow (in-scope) with a real `request_id`.
4. (1:10) ❌ deny `function_not_allowed` (out of scope). ❌ deny `Expired`.
5. (1:40) Revoke on-chain, then call → ❌ `credential_revoked`. Node flashes the agent red.
6. (2:10) Console mirror + audit trail; note the no-read-back gap (BUGS.md).
7. (2:35) Tests, live URL, thanks.

**Tracks/category:** $300 Best Agent Auth SDK implementation (primary — Wardix is *literally* a delegation/agent-auth tool); verified bug/doc log → $200; governance framing → Design Partner invite.

**Links:** GitHub: [github.com/edycutjong/wardix](https://github.com/edycutjong/wardix) · Live console: [wardix.edycu.dev](https://wardix.edycu.dev) · Video: [youtu.be/aYhjJqaob7c](https://youtu.be/aYhjJqaob7c) · Real demo: `npm run demo:real` · Tests: **19 (Vitest)**.

---
*Thank you for taking the time to review Wardix. — Edy*
