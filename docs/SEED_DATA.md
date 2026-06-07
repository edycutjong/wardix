# SEED_DATA — Wardix

## The ONE devastating demo query
> The `impostor-agent` (and a prompt-injected `payments-agent`) attempt a `transfer` toward an attacker-controlled host outside their grant.
> → Wardix **blocks both, live, on the console**, with reasons: *"unregistered did"* and *"exceeds scope: $40k > $1k limit; dest not allowlisted"* — while legitimate `payments-agent` transfers of $250 to allowlisted vendors sail through.

The "wow" is watching a red **DENIED** flash on the graph the instant a rogue agent acts — the kill switch the agent economy doesn't have yet.

## Seeded agents
| Agent | did:t3n | agent-registry | Grant (agent-auth) |
|---|---|---|---|
| `payments-agent` | ✅ registered | ✅ | transfer ≤ $1,000 to allowlist |
| `data-agent` | ✅ registered | ✅ | read() only, no transfers |
| `impostor-agent` | ❌ unregistered | ❌ | — (should be denied on identity alone) |

## Seeded message scenarios (deterministic script)
1. `payments → transfer($250, vendorA)` → **allow** (in scope, allowlisted).
2. `data → transfer($50, x)` → **deny** (action outside scope: data-agent can't transfer).
3. `impostor → transfer($40k, attacker)` → **deny** (unregistered identity).
4. `payments(injected) → transfer($40k, attacker)` → **deny** (over limit + dest not allowlisted) — *this is Sam's 3am incident, prevented.*

Four messages, **four distinct denial/allow reasons** → proves Wardix reasons over identity, scope, limits, and allowlists — not a blanket block.

## Generator
`scripts/seed.ts` — registers the 3 agents (2 real `did:t3n` via `agent-registry`, 1 impostor stub), sets their `agent-auth` grants, and queues the 4 actions deterministically.

## Anti-pattern avoided
Not a toy "block everything" filter. Each scenario isolates a different control (identity, action-scope, amount-limit, allowlist) so judges see real authorization logic.
