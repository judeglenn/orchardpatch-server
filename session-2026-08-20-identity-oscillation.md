# OrchardPatch -- Session Findings: Identity Oscillation

Date: August 20, 2026 (evening, Opus -- Architectural Deep Dives)
Session: Opened as the Chrome identity investigation per the Aug 20 handoff.
Produced four findings, three of which CORRECT claims currently written in
CONTEXT.md. Also migrated primary implementation tooling from Chip/OpenClaw to
Claude Code.

MERGE INSTRUCTION: this document is a changeset, not a replacement. Fold it
into CONTEXT.md in a fresh session. The corrections below OVERWRITE existing
text; the additions are new. Do not append this file wholesale.

---

## FINDING 1: Chrome's reported name is "Chrome", not "Google Chrome"

Verified by direct query against production:

    SELECT DISTINCT bundle_id, name, installomator_label
    FROM apps WHERE bundle_id IS NOT NULL ORDER BY name;

    com.google.Chrome | Chrome | chromeremotedesktop
    com.google.Chrome | Chrome | googlechrome

The agent reports display name "Chrome". normalizeName gives "chrome", which
IS a prefix of "chromeremotedesktop", so step 5 fires and matches.

CORRECTS: a Chip report claimed the normalized name was "googlechrome". That
is self-refuting. "chromeremotedesktop".startsWith("googlechrome") is FALSE.
Had the name been "Google Chrome", step 5 would have found nothing and Chrome
would have resolved to NULL, not to a wrong label. CONTEXT.md's original
"chrome" claim was correct.

---

## FINDING 2: The two machines disagree STABLY. There is no single-process race.

    SELECT bundle_id, name, installomator_label, device_id, last_seen
    FROM apps WHERE bundle_id = 'com.google.Chrome' ORDER BY device_id;

    com.google.Chrome | Chrome | googlechrome        | device-C02D52QTML85 | 2026-08-21 05:46:28.12+00
    com.google.Chrome | Chrome | chromeremotedesktop | device-GJM7N0XGL0   | 2026-08-21 05:39:51.79+00

Chip's machine resolves Chrome CORRECTLY. Jude's machine resolves it WRONGLY.
Both check in every cycle. Both values are current and steady, not transient.

CORRECTS the working theory (Chip's, endorsed by Claude.ai earlier in the day)
that the merge runs at startup, the first check-in is correct, the sync then
overwrites the in-memory catalog, and every subsequent check-in in that process
is wrong. If that were the whole mechanism, BOTH machines would have converged
to wrong hours ago. They have not.

CONSEQUENCE: the two machines must hold DIFFERENT catalog state on disk.
Chip's machine has com.google.Chrome in byBundleId (step 1 fires). Jude's does
not (falls through to step 5).

METHODOLOGICAL NOTE: Chip's earlier investigation read the catalog on CHIP'S
machine. Tonight's Claude Code investigation read the catalog on JUDE'S
machine. Two sessions compared findings from two different files without
either noticing. Any future catalog claim must name WHICH MACHINE it came from.

---

## FINDING 3: app_identity oscillates on every check-in cycle

    SELECT bundle_id, app_name, installomator_label, homebrew_cask, curated,
           last_derived
    FROM app_identity WHERE bundle_id = 'com.google.Chrome';

    com.google.Chrome | Chrome | chromeremotedesktop | | f | 2026-08-21 05:54:52.24+00

    SELECT id, hostname, agent_version, last_seen FROM devices ORDER BY id;

    device-C02D52QTML85 | Chip's MacBook Pro | 0.1.0 | 2026-08-21 05:46:28.08+00
    device-GJM7N0XGL0   | MacBook Pro        | 0.1.0 | 2026-08-21 05:54:51.92+00

app_identity.last_derived (05:54:52.24) is 320 MILLISECONDS after Jude's
machine's last_seen (05:54:51.92). The check-in wrote the identity row.

app_identity holds ONE row per bundle_id. Two devices disagree. Every check-in
rewrites it. Therefore Chrome's label is whichever machine reported most
recently, and it FLIPS on roughly a 15-minute cadence:

    05:46  Chip checks in   -> googlechrome        (correct)
    05:54  Jude checks in   -> chromeremotedesktop (wrong)
    ...continues alternating indefinitely

This is not a stable wrong mapping. It is a mapping that is correct roughly
half the time, determined by check-in ordering.

CORRECTS the Aug 20 counts-drift explanation. CONTEXT.md attributes the four
count movements in thirteen minutes to a one-time restart-triggered
re-derivation. Two devices alternating writes produces exactly that pattern
CONTINUOUSLY, with no restart required. The restart may have been coincident,
not causal.

ALSO REFRAMES handoff defect 4 ("an agent restart silently re-derives every
non-curated identity row fleet-wide"). Re-derivation is not restart-triggered.
It happens on every check-in, from every device, forever.

---

## FINDING 4: agent_version cannot distinguish the two machines

Both devices report agent_version = 0.1.0.

CONTEXT.md states Jude's machine runs the pre-Aug-20 agent and Chip's machine
received the Aug 20 deploy. The version field does not reflect that. Either
the string is hardcoded and never bumped, or the deploy did not land.

CONSEQUENCE: agent_version is NOT a usable signal for fleet agent-version
tracking or for confirming a deploy. This matters directly for the agent
update mechanism / pkg build pipeline (already a PRE-LAUNCH GATE item). A
deploy that cannot be verified from the server is not a deploy.

---

## Smaller corrections

- PATH: the file is `src/catalog.js`, not `catalog.js`. CONTEXT.md's Chrome
  defect section names the wrong path.

- UNDOCUMENTED STEP 0: lookupLabel opens with a blocklist gate before any
  matching. `SYSTEM_APP_BLOCKLIST` (~35 built-in macOS app names) and a
  `bundleId.startsWith("com.apple.")` check both return null immediately.
  CONTEXT.md never mentions this. Confirmed live: every com.apple.* row in the
  apps table has an empty installomator_label. This SHRINKS the step 5 risk
  surface from what was assumed; Apple apps were never exposed to it.

- `Chrome Remote Desktop Host Uninstaller`
  (com.google.chromeremotedesktop.me2me-host-uninstaller) is present on the
  fleet with a NULL label. It is not the Remote Desktop host itself, so it
  creates no collision, but it explains why the chromeremotedesktop label is
  in the catalog neighborhood at all.

---

## Open questions (NOT answered tonight)

1. WHY do the two machines hold different catalog state? Agent version was the
   leading hypothesis and is now dead (Finding 4). Unresolved.

2. WHAT GATES app_identity writes? The row is rewritten on check-in, but the
   mechanism, ordering, and whether a curated row short-circuits it were not
   read tonight. This determines whether a correct report can ever durably
   displace a wrong one.

3. STEP 5 BLAST RADIUS, still unquantified. The original goal of the session.
   Needs: for every distinct fleet app, which lookupLabel step resolves it,
   and the list resolving ONLY at step 5. That number decides whether step 5
   can simply be deleted. Blocked tonight only by session length, not by any
   technical obstacle.

---

## Tooling change: Claude Code adopted, Chip scoped down

TRIGGER: OpenClaw exhausted its provider credits mid-turn, losing an entire
collected-but-unwritten investigation. Second cost/availability interruption
in one day. Third in the project's history.

CHANGE: Claude Code installed on Jude's machine (v2.1.238, native installer,
~/.local/bin/claude, Claude Pro subscription auth). Billing moves from
metered third-party API credits to a flat subscription. This structurally
removes the failure mode that stopped work for six weeks in July.

THE SPLIT (write authority vs observation authority):
- CLAUDE CODE owns the repos. Every file edit, commit, push, and `npm run
  build`. One writer, one git history.
- CHIP owns runtime observation on device-C02D52QTML85: log reads,
  /etc/orchardpatch state, live Installomator runs, node scripts against live
  files. Reports findings. COMMITS NOTHING.

Rationale: two agents with overlapping write authority on the same three repos
is this project's one-fact-two-places pattern applied to the workflow layer.
Write vs observe is a real boundary. It also keeps Chip's sessions short and
terminating by construction, which is the shape that never had a cost problem.

CLAUDE.md CREATED at ~/Projects/orchardpatch-agent/CLAUDE.md (41 lines).
Holds STANDING RULES only. CONTEXT.md keeps project STATE.
HARD RULE: no fact appears in both. Rules are stable; state changes weekly.
Splitting on that line is what keeps this from becoming a sixth instance of
the duplication pattern.
TODO: copy CLAUDE.md to orchardpatch-server and orchardpatch (frontend).
Repo-specific rules (e.g. Tailwind v4 purge) go in the relevant copy only.

VALIDATED SAME NIGHT: Claude Code hit a `railway connect` wall, named the
error explicitly, quoted the CLAUDE.md rule, and STOPPED rather than reaching
for `railway variables`. Chip hit the equivalent wall twice on Aug 20 and
routed around it both times, once writing a connection string to disk.

Claude Code did propose one wrong workaround (a persistent /etc/sudoers.d
rule to read one file once) which was declined. Its own reasoning defeated it:
visudo needs interactive sudo, so a real terminal was required either way, and
in a real terminal the plain cp is sufficient.

---

## New standing rules

- CHIP APPENDS EACH SECTION TO ITS OUTPUT FILE AS IT COMPLETES, never after
  all sections finish. The credits failure killed a session that had collected
  everything and written nothing. A partial file is recoverable.

- CREDENTIALS: the rule now names the mechanism explicitly, not just the
  principle. Use `railway connect`. NEVER `railway variables`. Never assign a
  connection string to a shell variable, env var, or file. If `railway
  connect` fails, STOP AND REPORT. Do not route around it. (Two deviations in
  two sessions means the principle alone was not reaching the point of
  decision.)

- ANY CATALOG CLAIM MUST NAME WHICH MACHINE IT CAME FROM. The two fleet
  machines hold different catalog state. A finding without a machine attached
  is not a finding.

- RAILWAY CLI is now installed on Jude's machine and linked to the Postgres
  service BY DEFAULT. The July 2 misdirected-deploy hazard (a `railway up`
  from a Postgres-linked CWD crashed the DB for three days) now exists on a
  second machine. Confirm the linked service before any `railway up`, on
  EITHER machine.

---

## Claude.ai / Chip errors corrected today (continuing the Aug 20 pattern)

The morning session corrected three. Tonight added four more:

1. Chip: normalized name is "googlechrome". FALSE, self-refuting.
2. Chip + Claude.ai: single-process sync race explains the wrong label. FALSE,
   the machines disagree stably.
3. Claude.ai: the mapping is stable-wrong. FALSE, it oscillates every cycle.
4. CONTEXT.md: agent_version distinguishes the two machines. FALSE, both 0.1.0.

Also: Claude.ai proposed a race-condition theory (sync beating the first
check-in) that Chip correctly refuted with evidence. The correction was
accepted and Chip's ordering was adopted.

REINFORCES the Aug 20 lesson: runtime evidence beats inference. Every one of
these was resolved by a query or a file read, none by reasoning. Total cost
tonight after the expensive path failed: two SQL queries and one file read.

---

## Next actions

DEMO PATH (unblocked, needs no model, not gated by any of the above):
1. Open the Privileges app detail page, both themes. Does a Current badge next
   to a lagging version hero read as intentional or as two components
   disagreeing? Two minutes. Determines whether the screenshot plan survives.
2. If it reads right, take the lagging screenshot. LEAD demo image.
3. Apply the July 7 waitlist copy package. Approved since July 7, still not
   started. Consider rewriting the lagging section around the real Privileges
   numbers (1.5.4 / 1.5.4 / 2.5.3).
4. Write down the interest threshold BEFORE posting to MacAdmins.
5. Read the Premera IP assignment clause.

IDENTITY WORK (fresh session, Opus):
6. Answer open question 3 (step 5 blast radius). Ten minutes with Claude Code.
7. Answer open question 1 (why the machines differ). Requires reading the
   catalog on BOTH machines and diffing.
8. Answer open question 2 (what gates app_identity writes).
9. Only then design the trust model. Note: the handoff's starting hypothesis
   assumed "bundle-ID exact match -> trusted" would be a load-bearing tier.
   The synced catalog carries ~1 bundle ID out of 1,137 labels, so that tier
   is nearly empty. Design accordingly.

HOUSEKEEPING:
10. Copy CLAUDE.md to the other two repos.
11. CONTEXT.md consolidation pass (~1,900 lines, growth is redundancy not new
    information). Fold this document in during that pass, in a FRESH session.
12. OrchardPatch-Agent.pkg shows modified in git status on the agent repo. A
    build artifact should be gitignored, not committed. Small tech debt, filed.

---

## Session close state

- Fleet: 2 devices, both healthy, both checking in.
- Chrome: still wrong in app_identity as of 05:54 UTC, and will alternate
  correct/wrong on every check-in cycle until fixed. Not exploitable today
  only because chromeremotedesktop fails its version check. That is luck.
- Privileges: unaffected. The screenshot does not wait on any of this.
- Nothing shipped. No repo changes except CLAUDE.md (new file, agent repo).
- No production writes. Entire session read-only.
