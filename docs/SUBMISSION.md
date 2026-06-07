# SUBMISSION — Wardix

**Title:** Wardix — the control plane for delegated AI agents.

**Emotional hook (first line):** At 3am, Sam's invoice-paying agent got fed a malicious PDF and tried to wire $40k to an attacker. It almost cleared — because nobody could see or manage what the agents were allowed to do. Wardix is that missing control plane.

**Short description (≤150 chars):**
> Grant, monitor & revoke AI-agent permissions on Terminal 3's native agent-auth — rogue actions are blocked at the host layer; Wardix makes it visible.

**Long description (~500 words):**
Enterprises are delegating real authority to fleets of AI agents that call tools and move money. Terminal 3 already enforces what each agent may do: with the `agent-auth` host interface, a data owner grants an agent a scope — specific `functions` plus an `allowedHosts` egress allowlist — and any action outside that scope is rejected natively with `host/http.egress_denied`. The gap isn't enforcement; it's **operability**. Who granted which agent what? What did an agent just get denied for? How do I revoke a compromised agent right now, and prove it? Wardix answers those.

Wardix is a control plane with its own `did:t3n` identity that sits on top of Terminal 3's native agent permissions. It does four things. (1) **Grant/edit scopes** — Wardix drives `agent-auth-update` to set each agent's allowed functions and hosts. (2) **Pre-flight** — it runs `authorisation` read-only checks before a risky action. (3) **Observe** — it streams every allow/deny to a live console, building a tamper-evident audit log anchored by TEE attestation, plus a trust score per agent (denial counts over time). (4) **Revoke** — narrowing a grant takes effect immediately; the agent's next out-of-scope action is denied.

The demo is built around Sam's 3am incident, with three agents: a legitimate payments-agent (scope: a `transfer` function to an allowlisted host with a small limit), a read-only data-agent, and an unregistered impostor. We fire four actions. A normal $250 vendor payment is allowed. The data-agent attempting a transfer is denied — that function isn't in its grant. The impostor has no valid `did:t3n` identity. And the prompt-injected payments-agent trying to reach an attacker's host is denied at the egress allowlist — `host/http.egress_denied`. On the console, each denial flashes the offending node red the instant Terminal 3 rejects it. Four actions, four distinct reasons — and Wardix is the single pane where you saw it, and the one place you revoke.

This is built directly for Terminal 3's stated mission — "AI Agent Governance: hardware-attested mandates, so every agentic action is bounded, logged, and provable" — and for the buyers it names: banks, institutions, corporates. The agent economy needs a control plane before it needs more agents, and Terminal 3's `agent-auth` is the enforcement it stands on.

**Why ONLY Terminal 3:** Wardix's verdicts are real because enforcement is native. We use `agent-auth` (scoped grants + `agent-auth-update`), `authorisation` (pre-flight), `did-registry`/`agent-registry` (identity), `logging`/`outbox` (attested audit), and `contracts-call` (cross-agent calls) — five host interfaces inside an Intel TDX enclave. Remove Terminal 3 and you'd need a DID registry, a runtime-enforced per-function/per-host permission engine, a TEE+attestation service, and an audit-signing layer. *Take Terminal 3 out and you'd need 4 separate systems — and without native enforcement the block is advisory, not guaranteed.*

**Honest limitation:** Wardix manages and observes T3N's native enforcement; it does not re-implement the gate. MVP uses scope-based grants only — no ML/behavioral anomaly detection yet (heuristics stubbed).

**Demo video script (2–3 min):**
1. (0:00) Sam's 3am page — the $40k near-miss. The human stake.
2. (0:25) The model in 20s: `agent-auth` grants (functions + allowedHosts); out-of-scope → `host/http.egress_denied`. Wardix manages + watches it.
3. (0:50) Console: $250 vendor payment → ✅ allow.
4. (1:10) data-agent transfer → ❌ deny (function not granted). Impostor → ❌ deny (no valid did:t3n).
5. (1:40) Injected payments-agent → attacker host → ❌ `host/http.egress_denied` — node flashes red. Then **revoke** live → next action denied.
6. (2:10) Attested audit log + trust scores.
7. (2:35) Tests, live URL, thanks.

**Tracks/category:** $300 Best Agent Auth SDK implementation (primary — Wardix is *literally* an agent-auth tool); bug/doc log → $200; governance framing → Design Partner invite.

**Links:** GitHub: [github.com/edycutjong/dorahacks-t3adk-wardix](https://github.com/edycutjong/dorahacks-t3adk-wardix) · Live: [wardix.vercel.app](https://wardix.edycu.dev) · Video: [youtu.be/wardix-demo-adk](https://youtu.be/wardix-demo-adk) · Tests: **154 (Vitest)** · `scripts/bench.py` p50/p95 included.

---
*Thank you for taking the time to review Wardix. — Edy*
