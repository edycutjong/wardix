<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🛡️ Wardix — Agent Instructions

## Project
IAM & Control Plane for Delegated AI Agents. Built natively on Terminal 3's `agent-auth` SDK, Wardix intercepts, evaluates, and logs agent egress traffic to prevent rogue AI actions. It features dynamic scope revocation and visual trust scoring.

## Hackathon
**DoraHacks Terminal 3 ADK Hackathon 2026** — Targeting Best Agent utilizing Terminal 3 Agent Auth SDK ($300).

## Structure
- `src/app/` — Next.js 16 App Router pages (dashboard, API routes)
- `src/components/` — React 19 components (AgentNetworkMap, DecisionFeed, EgressAlertCard, AuthGrantPanel)
- `src/lib/` — Shared types, policy engine (`policy.ts`), T3N integration (`t3n.ts`), DB mock (`db.ts`)
- `src/lib/__tests__/` — Vitest test suites (100% lines/branch coverage required)
- `e2e/` — Playwright end-to-end tests
- `docs/` — README assets and SDK feedback (`BUGS.md`)

## Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19 |
| **Styling** | Tailwind CSS v4 |
| **SDK** | Terminal 3 Agent Auth (TEE Enclaves) |
| **Testing** | Vitest (Unit) + Playwright (E2E) |
| **Deploy** | Vercel |

## Key Rules
- **Frontend** = ESM (`import`), Next.js 16, React 19, Tailwind v4
- **Tests** = Vitest globals (`describe`/`it`/`expect`), coverage must remain 100%
- **E2E** = Run `npx playwright test`
- **Colors** = Neon Cyan (#06b6d4) for allowed traffic, Deep Slate (#1e293b) for backgrounds, Bright Red (#ef4444) for egress denials
- **Typography** = Geist Sans & Geist Mono
- **Aesthetic** = Cybernetic / Military SOC (Security Operations Center), dark mode only

## Critical Patterns
- `params` is a **Promise** in Next.js 16 — must `await`
- `agent-auth` policy engine operates on boolean `allow/deny` with string reasons
- Execution errors explicitly match `host/http.egress_denied` for T3N compliance
- `outputFileTracingRoot` is configured in `next.config.ts` due to monorepo lockfile handling
