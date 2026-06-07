# UI — Wardix

## Screens
### 1. Hero / Landing
- Headline: **"IAM for your AI agents."**
- Sub: "Verify every agent's identity, enforce its scope, and kill rogue actions in real time."
- Visual: a node graph with one node flashing red **DENIED**.

### 2. Live Console (the money shot)
- **Center:** force-directed graph of agents (nodes colored by trust score; edges = recent agent/contract calls). A denied action flashes the edge red and pulses the offending node.
- **Right rail:** real-time decision feed — `allow`/`deny` chips with agent, action, reason, attestation hash.
- **Top bar:** counters — messages adjudicated, denials, agents online.

### 3. Agent / Scope Detail
- Per-agent: did:t3n, agent-registry status, current `agent-auth` grant (allowed functions + allowedHosts), trust score history.
- Edit scope inline.

### 4. Incident Replay
- Pick the "$40k injection" scenario → step through the 4 seeded messages with the verdict + reason for each. The demo's narrative spine.

## Components
`AgentGraph`, `DecisionFeed`, `VerdictChip` (green/red), `ScopeEditor`, `DelegationChain`, `TrustBadge`, `IncidentReplay`.

## Design tokens
- Allow = emerald `#059669`; deny = red `#dc2626`; oversight/brand = slate-indigo `#1e293b`.
- Monospace for the decision feed; the red DENIED chip is the visual signature.

## Responsive
Mobile: graph collapses to a vertical agent list; decision feed becomes the primary view (this is an ops/alerting tool — the feed matters most on a phone at 3am).
