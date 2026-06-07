# RESEARCH — Terminal 3 Agent Dev Kit Bounty Challenge (beta)

## Event
- **Name:** Terminal 3 Agent Dev Kit Bounty Challenge (beta) — "easter egg" beta launch
- **Platform:** DoraHacks — `https://dorahacks.io/hackathon/t3adkdevchallengebeta/detail`
- **Organizer:** Terminal 3 (TEE infra for data privacy / agentic security)
- **Runs:** 4 June 2026 09:00 → 7 June 2026 23:59 (GMT+8) · Virtual
- **Submission:** GitHub link + demo video **required**

## Prizes
| Prize | Amount | Judging focus |
|---|---|---|
| Best Agent Auth SDK implementation | **$300** | problem size · agent stability · creativity |
| Most detailed dev (bugs + doc gaps) | **$200** | volume + quality of bug/doc-gap reports |
| **Bonus** | Invite | **Terminal 3 Design Partner** — enterprise distribution (govs, banks, institutions, corporates) |

> Real prize = Design Partner invite. Wardix is built squarely for T3's stated mission: **"agentic AI security and governance."**

## Theme & Tags
AI · security · trust · agent · agentic · infrastructure · identity · rust · wasm · json · ethereum. Thesis: verifiable agent identity to act/transact safely on TEEs.

## SDK Surface (VERIFIED against docs.terminal3.io — see `../ADK_REFERENCE.md`)
- **ADK** client (TypeScript) `T3nClient` → `handshake()`, `authenticate(createEthAuthInput(addr))`, `execute`/`executeAndDecode`.
- **`agent-auth`** — delegated agent permissions (`functions` + `allowedHosts`) via `agent-auth-update`; out-of-scope → `host/http.egress_denied`. **This is the primitive Wardix manages.**
- **`authorisation`** — read-only pre-flight permission checks.
- Identity: **`did:t3n`** (`did-registry`); agents discoverable via **`agent-registry`**.
- Cross-agent calls: **`contracts-call`** (synchronous cross-contract). Audit: `logging`/`outbox` + TEE attestation.
- TEE: **Intel TDX** + Wasmtime. Sandbox **test tokens** via claim page.

## Competitor Patterns (inference)
Small beta field. Most teams will build a *single* agent (DeFi/health/KYC). **Almost no one will build the layer that governs a fleet of agents** — that's Wardix's differentiation, and it's the most forward-looking framing (the agent economy needs a cop before it needs more agents).

## Winner Analysis
No prior editions. Apply workflow postmortems: lead with one human's stakes; go past the docs example — T3N's `agent-auth` enforces scope natively, so Wardix must add the *management + observability + revocation* layer (grant/edit/revoke, live denial feed, attested audit), not re-implement the gate; 3+ host interfaces; reproducible benches; 100+ tests; honest limits; gratitude.

## Implications for Wardix
- **Rubric fit:** problem (rogue/compromised agents in multi-agent systems — the #1 enterprise fear) ✅ · stability (deterministic allow/deny policy engine) ✅ · creativity (a *meta-agent that secures other agents*) ✅
- **Design Partner fit:** governance consoles are exactly what banks/governments procure.
- **Demo edge:** "watch a prompt-injected agent try to wire funds → Wardix blocks it live."
