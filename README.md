# OrchardPatch Fleet Server

The central server for [OrchardPatch](https://orchardpatch.vercel.app) — receives agent check-ins, stores fleet inventory, serves the dashboard API, and coordinates patch jobs.

**Production:** https://orchardpatch-server-production.up.railway.app  
**Stack:** Node.js / Express / PostgreSQL on Railway

---

## What it does

- Receives inventory check-ins from OrchardPatch agents (every 15 min)
- Stores fleet-wide app inventory in PostgreSQL
- Serves the dashboard API (devices, apps, patch status, jobs)
- Coordinates patch jobs via a polling model — agents pick up work, server never pushes
- Maintains a version cache (`latest_versions`) populated by agents running Installomator in DEBUG mode
- Serves `app_catalog` — 1,083 Installomator labels with bundle IDs and team IDs

## Architecture

```
Agent (LaunchDaemon, root)
  │
  ├── POST /checkin          — inventory push every 15 min
  ├── GET  /pending-patches  — poll for queued patch jobs (every 45s)
  ├── POST /patch-jobs       — report completed job results
  └── POST /api/version-sync/ingest  — push latest version data (~every 2.5 hrs)
  
Dashboard (Next.js on Vercel)
  │
  ├── GET /devices           — fleet list with outdated counts
  ├── GET /apps/status       — patch_status per app (current/outdated/unknown)
  ├── GET /stats             — fleet health summary
  └── POST /patch            — queue a patch job for an agent to pick up
```

Server → agent communication is **not possible** (agent is behind NAT). Everything is agent-initiated polling.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/checkin` | Agent inventory push |
| GET | `/devices` | Fleet list with outdated_count |
| GET | `/devices/:id` | Single device with app list |
| GET | `/apps` | All app rows across fleet |
| GET | `/apps/status` | Patch status per app via latest_versions join |
| GET | `/stats` | Fleet health summary |
| POST | `/patch` | Queue a patch job |
| GET | `/pending-patches` | Agent polls for queued work |
| POST | `/pending-patches/:id/claim` | Agent atomically claims a job |
| POST | `/patch-jobs` | Report job results |
| GET | `/patch-jobs` | Patch job history |
| POST | `/api/version-sync/ingest` | Ingest version data (agent-push) |
| GET | `/api/version-sync` | Full version cache |
| GET | `/api/version-sync/:label` | Single label lookup |
| POST | `/api/catalog-sync` | Sync Installomator catalog from GitHub |
| GET | `/api/catalog` | Browse app catalog |

All endpoints require `x-orchardpatch-token` header matching `SERVER_TOKEN`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Railway env ref) |
| `SERVER_TOKEN` | Auth token for all API endpoints |
| `GITHUB_TOKEN` | PAT for catalog-sync GitHub API calls |
| `PORT` | Set automatically by Railway |

## DB schema (key tables)

- **devices** — id, hostname, serial, model, os_version, agent_version, last_seen
- **apps** — device_id, bundle_id, name, version, installomator_label, path, source
- **latest_versions** — label (PK), latest_version, last_checked, error
- **app_catalog** — label (PK), app_name, bundle_id, expected_team
- **patch_jobs** — job history with status, exit code, log
- **pending_patches** — queued work for agents to claim

> `is_outdated` and `latest_version` on the `apps` table are legacy fields — never populated by the current agent. `latest_versions` table is the source of truth for version comparison.

## Running locally

```bash
npm install
DATABASE_URL=postgres://... SERVER_TOKEN=dev-token node src/server.js
```

Schema migrations run automatically on startup.

## Related repos

- [orchardpatch](https://github.com/judeglenn/orchardpatch) — Next.js dashboard
- [orchardpatch-agent](https://github.com/judeglenn/orchardpatch-agent) — macOS agent
- [orchardpatch-waitlist](https://github.com/judeglenn/orchardpatch-waitlist) — marketing waitlist
