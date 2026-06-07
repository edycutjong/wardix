# PRD — Wardix

> **Emotional Hook:** At 3am, Sam — the lone ops engineer at a 12-person fintech — got paged: their invoice-paying AI agent, fed a malicious PDF, had just tried to wire $40k to an attacker's address. It almost went through. Nobody was watching the agents.

## Problem Statement
Enterprises are deploying *fleets* of AI agents that call tools, move money, and delegate to each other. There is no IAM for this. A prompt-injected or impersonating agent can act outside its authority and nobody sees it until the money's gone. Identity, permission scope, and a kill switch — the basics of human access control — don't exist for agent-to-agent traffic.

## Solution Overview
**Wardix** is a `did:t3n`-verified **control plane** over Terminal 3's native `agent-auth`. T3N already blocks out-of-scope agent actions at the host layer (`host/http.egress_denied`); Wardix makes that operable — it grants/edits/**revokes** each agent's scope (`functions` + `allowedHosts`) via `agent-auth-update`, runs `authorisation` pre-flight checks, and streams every allow/deny into a tamper-evident, TEE-attested audit log. It's the management + observability layer the agent economy is missing.

## Target Users
- **Primary:** platform/ops/security engineers running multi-agent workflows.
- **Buyer (Design Partner lens):** banks, institutions, anyone with autonomous agents touching value.

## Core Features (MVP, 24–48h)
1. **Wardix identity** — `did:t3n` (`did-registry` / `agent-registry`), with permission to manage agent grants.
2. **Scope manager** — grant/edit/revoke each agent's `functions` + `allowedHosts` via `agent-auth-update` (native enforcement does the blocking).
3. **Pre-flight + identity checks** — `authorisation` read-only checks; resolve each acting agent's `did:t3n`.
4. **Policy engine** — scope rules per agent (`payments-agent may transfer ≤ $1k to allowlisted addrs`); anything outside → **block**.
5. **Live console** — agent-network topology, per-agent trust score, real-time allow/deny feed, violation alerts.
6. **Tamper-evident audit log** — every decision + TEE attestation.

## User Stories
- *As Sam*, the injected payment is **denied** ("exceeds scope: $40k > $1k, dest not allowlisted") before it executes; I get an alert, not a post-mortem.
- *As a security lead*, I see which agent asked for what, and why each was allowed/blocked.
- *As a compliance auditor*, I export a signed decision log.

## Success Metrics
- Allow/deny decision < 300ms (inline, doesn't stall legit traffic).
- 100% of out-of-scope actions blocked in the demo scenario.
- 3+ SDK surfaces; 100+ tests.

## Out of Scope
- Building the worker agents themselves (use 3 simple stub agents: payments, data, a malicious impostor).
- ML anomaly detection (rule-based scope enforcement only for MVP; flag-only heuristics optional).
- Multi-tenant SaaS, billing.

## Scope Constraint
**ONE core flow with extreme depth:** *agent acts → T3N `agent-auth` allows or denies natively (`host/http.egress_denied`) → Wardix records the verdict with attestation and lets you revoke.* The console, trust scores, and topology all visualize this one decision.
