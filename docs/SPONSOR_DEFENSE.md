# SPONSOR DEFENSE — "Why ONLY Terminal 3" (Wardix)

> API verified against `docs.terminal3.io` (see `../ADK_REFERENCE.md`). Wardix is a control plane over T3N's **native** agent-permission enforcement — not an external interceptor.

## Terminal 3 host interfaces used (by name)
1. **`agent-auth`** — the core: Wardix grants/edits/revokes each agent's delegated scope (`functions` + `allowedHosts`) via `agent-auth-update`. Enforcement is native — out-of-scope actions fail with `host/http.egress_denied`. `src/lib/t3n.ts`.
2. **`authorisation`** — read-only pre-flight permission checks. `src/lib/preflight.ts`.
3. **`did-registry` / `agent-registry`** — verifies *which* `did:t3n` agent acted (an unregistered impostor has no valid identity). `src/lib/policy.ts` and `src/lib/t3n.ts`.
4. **`logging` / `outbox`** — tamper-evident decision log, anchored by TEE attestation. `src/lib/t3n.ts` and `src/lib/db.ts`.
5. **`contracts-call`** — observes synchronous cross-contract (agent-to-agent) calls within a transaction.
6. **TEE (Intel TDX) + attestation** — makes the enforcement and the audit trail trustworthy even against a compromised host.

## What you'd need without Terminal 3
- A verifiable agent-identity scheme + registry (to know who an agent is).
- A delegated-permission system with per-function + per-host (egress) scoping **enforced at the runtime layer**, not advisory.
- A confidential-compute enclave + attestation so the gate and the log can't be tampered with.
- An audit-signing pipeline.

→ **Take Terminal 3 out and you'd need ~4 separate systems** (a DID/registry, a runtime-enforced permission engine, a TEE+attestation service, and an audit-signing layer) — and without **native** host-layer enforcement, "block the agent that exceeds its scope" becomes advisory, not guaranteed. T3N's `agent-auth` makes the block real; Wardix makes it manageable.

## Honest limitations
- Wardix **manages and observes** T3N's native enforcement — it does not (and need not) re-implement the gate. Its value is the control plane, not a second enforcement path.
- MVP uses **rule/scope-based** grants only — no behavioral/ML anomaly detection (heuristics stubbed).
