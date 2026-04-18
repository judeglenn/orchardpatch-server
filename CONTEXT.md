# OrchardPatch — Project Context

Last updated: April 17, 2026

## What OrchardPatch is
A Mac admin tool providing complete visibility into managed macOS fleet apps
and patching via Installomator — without touching your MDM. Tagline:
"See Everything. Patch Anything. Break Nothing."

## Repos
- Fleet server: github.com/judeglenn/orchardpatch-server
  - Local: ~/Projects/orchardpatch-server
  - Deployed: https://orchardpatch-server-production.up.railway.app
- Agent: github.com/judeglenn/orchardpatch-agent
  - Local: ~/Projects/orchardpatch-agent
- Waitlist: github.com/judeglenn/orchardpatch-waitlist
- Live app: https://orchardpatch.vercel.app
- Marketing: https://orchardpatch.com

## Stack
- Fleet server: Node.js/Express on Railway
- Database: PostgreSQL (Railway-hosted), schema auto-migrates on startup
- Web app: Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel
- Agent: Node.js LaunchDaemon (root), local HTTP on port 47652
- Auth: x-orchardpatch-token header, SERVER_TOKEN env var

## Environment variables (Railway)
- DATABASE_URL — PostgreSQL connection (Railway env ref)
- SERVER_TOKEN — auth token for all API endpoints
- GITHUB_TOKEN — fine-grained PAT for catalog-sync GitHub API calls
  (tighten scope to Installomator repo only when convenient)
- PORT — set by Railway
- DATA_DIR — data directory

## Architecture decisions
- Agent ↔ server: REST polling only, no WebSocket
- Server cannot reach agents directly (Railway → NAT'd agent doesn't work)
- Version data is agent-initiated push, not server-pull
- Agent polls every 15 min; version checks run every 10 check-ins (~2.5 hrs)
- Patching via Installomator only — no MDM conflicts, no Secure Token needed

## Key design constraints
- Works in BeyondTrust / privilege management environments
- No sudo required — LaunchDaemon runs as root
- No MDM conflicts — agent pattern same as Jamf/Mosyle/Kandji
- Installomator is the only patch mechanism (1,083 supported apps)
- Single-tenant for now — multi-tenancy is a prerequisite for
  Patch by the Orchard enterprise tier

## AI development workflow
- Primary dev assistant: Chip (OpenClaw, Claude via API)
- Architecture / planning: Claude.ai (claude.ai)
- Workflow: Claude.ai for architecture decisions and code scaffolding,
  Chip for execution and codebase-aware implementation
- Context is lost when Chip compacts — use this file to restore
- Start Claude.ai sessions by pasting current CONTEXT.md for instant context
- End every session: ask Claude.ai to update CONTEXT.md, paste to Chip, commit

## Feature status

### ✅ Shipped
- App inventory collection and display
- Fleet view with device detail pages
- Patch by the Fruit (individual app patching, end-to-end)
- Patch job queue with real-time status polling
- Patch history with expandable logs
- Reports page with fleet health data
- PostgreSQL persistence
- Security hardening (parameterized queries, rate limiting, CORS)
- app_catalog table — 1,083 Installomator labels with bundle IDs and team IDs
- latest_versions table — self-populating via agent every ~2.5 hours
- POST /api/version-sync/ingest — agent pushes version data up
- GET /api/version-sync and /api/version-sync/:label — cache lookups
- POST /api/catalog-sync — fetches full Installomator catalog from GitHub
- GET /api/catalog — browse/search catalog
- Agent src/version-checker.js — Installomator DEBUG=1 batch runner
- Agent scheduler hook — version checks every 10 check-ins, async, non-blocking

### ⚠️ Partially built
- Patch by the Bushel (fleet patching) — UI exists, bulk dispatch not wired
- Jamf API integration — proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation — single-tenant only

### ❌ Not yet built
- 🔴/🟡/✅ version status UI in inventory dashboard (next priority)
- .pkg installer (structure exists, pkgbuild step not done)
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- User auth / login
- Patch Policy UX (Silent/Notify/Scheduled/User-initiated modes)
- Patch by the Orchard (policy-based auto-remediation, enterprise tier)
- Automated catalog-sync schedule (Routine or cron — manual curl for now)
- Sentry / error monitoring
- DB indexes for fleet queries

## Patch by the Orchard vision
Policy-based auto-remediation — "always keep Chrome within 1 version of
latest." Enterprise tier. Needs multi-tenancy first. Version cache
(shipped today) is the foundational dependency.

## Open items / tech debt
- GitHub PAT scoped to all public repos — tighten to Installomator repo only
- agent_url column on devices table exists but unused —
  reserved for future server-initiated flows
- No DB indexes on fleet queries yet — will matter at scale
- Catalog auto-sync not yet automated — running manually via curl for now
- Routines integration planned for catalog-sync (weekly) and
  version-sync supplementary source
- Update CONTEXT.md at end of every session and commit to orchardpatch-server
