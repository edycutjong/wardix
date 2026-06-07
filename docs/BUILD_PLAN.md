# BUILD PLAN — Wardix (48h sprint, demo-first)

## Principle
The "$40k injection → DENIED on the live graph" moment must work by hour 24. Build the deny path before the pretty graph.

## Hour-by-hour
### Day 1 (0–24h) — Make the gate real
- **0–2h** Claim T3 tokens; set up ADK dev env. Repo: Next.js console + `wardix/` TS service + `agents/` stub clients. **Start `BUGS.md`.**
- **2–5h** Provision Wardix `did:t3n` (`did-registry`/`agent-registry`); provision 2 worker agents' DIDs. (Riskiest identity work first.)
- **5–9h** Set an `agent-auth` grant (`functions` + `allowedHosts`); have a worker agent attempt an out-of-scope call → confirm native `host/http.egress_denied`. **First green light: native deny surfaces in Wardix.**
- **9–13h** Policy engine in TEE session: scope + amount + allowlist checks. The 4 seeded scenarios return 4 correct verdicts in the terminal.
- **13–17h** `scripts/seed.ts` (3 agents, scopes, 4 messages, deterministic). Attested audit log entries.
- **17–24h** Console skeleton: `DecisionFeed` (SSE) + `AgentGraph`. Get a denial to flash red live.

### Day 2 (24–48h) — Depth, proof, polish
- **24–29h** `IncidentReplay` stepper, trust scores, scope editor, delegation-chain view.
- **29–34h** Harden: malformed messages, expired session, revoked agent. **114 Vitest tests** (verdict truth table per control), count in README.
- **34–38h** `scripts/bench.py` (p50/p95 over 200 adjudications). `scripts/check_submission_readiness.py`. `DEMO.md`.
- **38–42h** Deploy console (Vercel) + wardix service (Fly/Railway). Live URL. Landing page.
- **42–46h** Record demo. Finalize SUBMISSION/SPONSOR_DEFENSE/README.
- **46–48h** Submit GitHub + video. Submit `BUGS.md` for $200. Buffer.

## Must vs nice
| Must | Nice |
|---|---|
| Identity-based deny (impostor) | ML anomaly scoring |
| Scope/limit/allowlist deny | Batching for high throughput |
| Live red-flash on graph | Slack/PagerDuty alert integration |
| Attested audit log | Multi-tenant |
| Deploy + video + BUGS.md | Policy import/export UI |

## Mandatory deliverables
`scripts/bench.py` · `scripts/check_submission_readiness.py` · `DEMO.md` · `ARCHITECTURE.md` · landing page · `BUGS.md`.
