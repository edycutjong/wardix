# PRODUCTION PLAN — Wardix (proof-of-production)

## Live URL
- **Console + demo:** Vercel — [wardix.vercel.app](https://wardix.vercel.app)
- **Wardix service:** Railway / Vercel Serverless — holds the persistent `T3nClient` session + drives `agent-auth-update`.

## On-chain / registry proof
- Wardix `did:t3n` + the 2 worker agents registered via **`did-registry` / `agent-registry`**. DIDs are:
  - `did:t3n:payments` (payments-agent)
  - `did:t3n:data` (data-agent)
  - `did:t3n:impostor` (unregistered impostor)
- Audit-log entries carry TEE attestation hashes; client applications can query `/api/decisions` to verify the hashes.

## Published package
- The control-plane functions are exposed via standard JSON API endpoints and a simulated client wrapper in `src/lib/t3n.ts`.

## Tests
- **114 tests (Vitest)**, run via `npx vitest run`.
- Coverage: verdict truth table (identity / scope / limit / allowlist denials), delegation-chain resolution, attestation presence on every log entry, a test that **fails** if any out-of-scope action is ever allowed.

## Benchmark
- `scripts/bench.py` → p50/p95/mean over 200 adjudications (allow + deny mix). Latency is calculated in high resolution using Node's `process.hrtime.bigint()`.

## Verify / integrity
- `scripts/verify_blocks.ts` — replays the 4 seeded scenarios and asserts the exact verdict + reason for each (regression guard on the core security claim).

## Readiness gate
- `scripts/check_submission_readiness.py` scans the repository and fails on any leftover placeholders.
