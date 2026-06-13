# Apply the Optivem School engine to the real deployment

> Companion to [`20260610-0927-optivem-school.md`](20260610-0927-optivem-school.md) (the product/engine plan).
> That plan built + live-tested the engine against `optivem/school-test`. **This plan covers standing up
> the *real* Optivem School instance** — real roster/courses, private repo, hosted + gated on Cloudflare.

## TL;DR

- The engine (`optivem/school`) is built, hardened, and live-verified. This is about pointing it at the
  **real** data + hosting.
- **Decision 1 (target repo):** recommend **`optivem/hub` becomes the real Optivem School instance** — it
  already *is* the live learning system (real students, courses, board #18). Alternative: a fresh repo.
- **`hub` already has an *ancestor* of this engine** (school was extracted from it). So this is a
  **reconciliation/upgrade**, not a greenfield apply: bring hub onto the (hardened, generalized) school
  engine without losing hub's extra features.
- **Timing:** `hub` is **still public today**; it's slated to go **private on 2026-07-02** (Team→Free
  downgrade — see the parked hub-privacy plan). When it goes private, **GitHub Pages stops serving it**
  (Free plan), so the dashboard **must** be on **Cloudflare Pages + Access** by then — exactly the setup
  validated on `school-test`. So this migration is naturally bounded by that date.

## ▶ RESUME HERE (as of 2026-06-12) — Access built but set PUBLIC; re-gate before 2026-07-02

**This section is self-contained so a fresh session can continue without prior chat history.**

> 🔴 **HARD CHECKPOINT — re-gate before 2026-07-02 (hub goes private).** Access is fully built but
> **intentionally set to PUBLIC tonight** via a `Bypass / Everyone` policy named `Public (temporary)` on
> the `optivem-learn.pages.dev` app (reverting to how the dashboard has been all along — it was never
> private before tonight). The page serves with **no login**. **To re-gate: delete the `Public (temporary)`
> Bypass policy** — the GitHub IdP + `Students and admins` Allow policy are still in place underneath. A
> public dashboard once hub is private would expose student data, so this MUST happen before the flip.

### Done so far
- Engine on hub `main` (hardened + full superset of hub); end-to-end verified via the **`SHOP`** sandbox
  project (board #18). `sync-project.mjs` data-loss bug fixed (preserves option ids).
- **Cloudflare Pages live** — project **`optivem-learn`**, **model A** (CF runs `generate-dashboard.mjs`
  at build). Build settings: command `node scripts/generate-dashboard.mjs`, output `docs`, env
  `GITHUB_TOKEN`(read-only)/`GITHUB_OWNER=optivem`/`GITHUB_REPO=hub`/`NODE_VERSION=20`.
- **hub `dashboard.yml`** = model A: POSTs the **`CF_DEPLOY_HOOK`** secret on every `auto-on-*` completion
  + 30-min schedule. (Pages deploy removed; `dashboard.yml` is now deployment-owned — `apply` skips it.)
- **`learn.optivem.com` LIVE** (CF custom domain + Bluehost CNAME `learn` → `optivem-learn.pages.dev`).
- **`optivem.github.io/hub`** serves a static redirect → `https://learn.optivem.com/` (Pages on branch
  `main`/`docs`; `hub/docs/index.html`).
- **`optivem-students`** GitHub team (id 18008854, **`repos_count: 0` — no repo access**, default perm
  `pull` but 0 repos so moot — *never add a repo to it*). Currently **1 member: `valentinajemuovic`**.
- ✅ **CLOUDFLARE ACCESS LIVE (2026-06-12)** — dashboard is **gated**; `learn.optivem.com` +
  `optivem-learn.pages.dev` no longer public. Setup that worked:
  - **GitHub OAuth App** (in `optivem` org) — callback `https://optivem.cloudflareaccess.com/cdn-cgi/access/callback`.
  - **Zero Trust team domain = `optivem.cloudflareaccess.com`** (team was renamed from auto-name
    `raspy-tree-0afe` → `optivem`; rename took effect).
  - **GitHub IdP** added under **Integrations → Identity providers** (new UI; *not* Settings→Auth).
  - **Access app `optivem-learn.pages.dev`** (Access controls → Applications) covers **both** hostnames.
  - **Policy `Students and admins`**, Allow, **Include = GitHub → Organizations → `optivem`** (reliable
    admin unblock — see gotcha #3). Verified: admin logs in via GitHub and reaches the dashboard.
  - ⚠️ **Currently OVERRIDDEN by a `Bypass / Everyone` policy (`Public (temporary)`) → page is PUBLIC,
    no login** (decided 2026-06-12, Friday — didn't want to send student invites going into the weekend).
    Delete that Bypass policy to re-gate. See the red HARD CHECKPOINT at the top of this section.
  - **Gotchas hit (for future reference):**
    1. **No-policy = total lockout.** The app existed + covered both hostnames but had **no saved policy**
       (earlier attempt lost in a 500). Access is default-deny → "that account does not have access" for
       *everyone*. Fix = save an Allow policy.
    2. **Stale team-domain branding.** After the team rename, the Pages-gate login page still showed
       `raspy-tree-0afe.cloudflareaccess.com` — **cosmetic only**, not the blocker (Access apps keep their
       original auth-domain login URL until re-saved). Team domain is genuinely `optivem`.
    3. **`finish setup` IdP test 500s** (Cloudflare-side, FRA edge) — the standalone IdP Test is flaky and
       **not required**; validate via the real app login instead.
    4. **Emails-include rule is fragile** — only matches the email GitHub passes (your GitHub *primary*
       email). Used **GitHub → Organizations → `optivem`** instead as a can't-miss admin rule.

### ⚠️ NEXT ACTIONS
**(All PAUSED 2026-06-12 — the page is public for now. A + B below are the re-gating work; do them as
part of the 2026-07-02 re-gate, or whenever onboarding students. Re-gate itself = delete the `Public
(temporary)` Bypass policy.)**

**A — Tighten the Access policy to the team (you, in Cloudflare).** Current Include is `Organizations →
optivem` (admits *any* org member). Switch to least-privilege:
  1. Edit policy `Students and admins` → **add Include: GitHub → Teams → `optivem` → `optivem-students`**.
  2. **Test incognito you still get in** (you're already in the team) before removing the org rule.
  3. **Remove** the broad `Organizations → optivem` include. (Keeps non-student org members out.)

**B — Populate `optivem-students` (agent can do; fires 15 real org invites — confirm first).** Adds the 15
students as org members + team members via `gh api PUT /orgs/optivem/teams/optivem-students/memberships/<user>`.
Org base perm is `none` (verified) → zero repo access, identity-only as designed. **Students can't access
until they ACCEPT the org invite.** Handles: `jcupac, longhibeck, ognjenkl, CurlyFire, RomainChamb,
jasonribble, anilvv1, david-oc-miller, ndeleva-armedia, sowmiya-thoguluva, Andrijana-N, astevanovski,
gerasovskiboris, anatrajkovskaarmedia, vilosia-ai`.

**C — Optional cleanup:** the leftover **`Optivem School Test`** Access app (gates `optivem-school-test.pages.dev`,
policy "Members") is from earlier school-test validation — delete when school-test is retired.

### Other open follow-ups
- ⚠️ **Renew `PROJECT_TOKEN` before 2026-06-17** (expires in 5 days) — it powers all 5 hub workflows
  *and* the CF build token; expiry breaks automation + dashboard builds. Use a long-expiry, read-only
  token for CF ideally.
- **Step 5 — Thinkific → `students.json` sync** (manual now, automatic later).
- **Step 7 — flip hub private 2026-07-02**; verify gated `learn.optivem.com` still serves (CF doesn't
  need Pages). After that, `optivem.github.io/hub` (the redirect) stops serving — fine.
- Optional cosmetic: dashboard disclaimer lost the personal "DM Valentina on Thinkific" link in the
  generalization — restore via config/template if wanted.
- gh CLI can't create PRs on the `optivem` org (push works) — direct-to-`main` is the workflow here.

## Decision 1 — which repo is the real deployment?

- **A (recommended): `optivem/hub`.** It's the live system with the real roster, courses, and board
  (#18). Making it *the* Optivem School instance means one home, real continuity, and improvements to
  `optivem/school` flow in via `apply`. Cost: a careful in-place upgrade of a *live, in-use* repo.
- **B: a new repo** (e.g. `optivem/academy-live`). Clean slate, no migration risk — but you'd duplicate
  hub's config + board and run two systems, or migrate data anyway. More overhead, little benefit.

**Recommend A.** The rest of this plan assumes hub is the target; revisit if you prefer B.

## The engine delta (hub vs school) — what reconciliation means

`hub` is a **superset** of `school` today:

- **Actions in hub but not school (5):** `add-assignee`, `assign-issue`, `remove-assignee`,
  `set-milestone`, `check-prerequisites`. (Several are currently *commented out* in hub's
  `auto-on-created` — assignees, prereqs.)
- **Workflows in hub but not school (3):** `auto-on-deleted`, `auto-on-edited`,
  `nudge-unanswered-discussions`.
- **Shared actions/workflows:** hub has the **older, un-hardened** versions (same `${{ inputs }}`-inline
  injection bug school just fixed) and **`dashboard.yml` deploys to GitHub Pages** (vs school's
  Cloudflare-commit model).

So a naive `apply school → hub` would: overwrite hub's shared files with school's hardened versions
(good), **leave hub's 5 extra actions + 3 extra workflows untouched** (they aren't deleted — fine), but
**overwrite `dashboard.yml`** (Pages → Cloudflare-commit — intended) and **not** carry hub's extras back
into school (so the two diverge).

**Goal: keep `optivem/school` as the single engine source of truth.** Therefore, *before* applying,
**port hub's still-wanted extras into `school`** so school ⊇ hub, then `apply` cleanly.

## Steps

1. **Confirm Decision 1** (hub vs new repo).
2. **Port ALL hub extras into `optivem/school`** (Decision 2 — full superset, `school ⊇ hub`) —
   ✅ **DONE 2026-06-12** (commit `81c9c07`):
   - `auto-on-edited` (assignee/milestone lockdown guard), `auto-on-deleted` (log),
     `nudge-unanswered-discussions` — each given the `check-configured` gate; `dashboard.yml` now
     refreshes on `auto-on-deleted` via `workflow_run`.
   - `add-assignee`, `remove-assignee`, `set-milestone`, `assign-issue`, `check-prerequisites` — all
     hardened (string inputs passed via `env:`, closing the `${{ inputs }}`-inline injection bug).
     `assign-issue`/`check-prerequisites` stay dormant (commented in `auto-on-created`, matching hub).
   - **Live-tested on `school-test`** (applied + pushed): assignee guard reverts + warns ✅, milestone
     guard clears + warns ✅, `auto-on-deleted` logs ✅, `nudge` dry-run runs ✅. (`assign-issue` /
     `check-prerequisites` validated by `node --check` + board-field-name match, not live — dormant.)
3. **Backport the hardening** by virtue of step 2 + `apply` — ✅ **DONE 2026-06-12** (hub `93444af`):
   hub's shared actions now have school's env-based (injection-safe) versions, schema-validating
   `load-config`, reason-based reject, `init`/`sync`/`apply`, content-hash dashboard.
4. **Apply the school engine onto hub** — ✅ **DONE 2026-06-12** (hub `93444af`, direct to `main`):
   - `node scripts/apply.mjs` from `school@81c9c07`; reviewed diff offline (new `load-config` validates
     hub's real config — 15 students / 8 projects / 2 courses, Schema OK). `config/*.json` untouched.
   - **`dashboard.yml` held back** — hub keeps its GitHub-Pages deploy until the hosting cutover (step 6).
   - Did a `school-engine` branch + dry-run first, then merged direct to `main` (PRs aren't the workflow
     here; gh also can't create PRs on the org — push works, see memory). Branch deleted.
   - **End-to-end verified on LIVE hub** via a dedicated **`SHOP` (Optivem Shop) sandbox project** added to
     config (`098eaba`; lead `valentinajemuovic`, team `[valentinajemuovic, jcupac]`, repo `optivem/shop`,
     Pipeline course; board #18 reconciled): create → **In Review** (fields + title set) ✅ → reviewer
     comment → **In Progress** ✅ → close → **Done** ✅ → delete → `auto-on-deleted` ✅. Test issue removed;
     SHOP sandbox kept for future testing.
5. **Roster:** keep hub's real `config/` (students/reviewers/projects/courses, board #18). Wire the
   **Thinkific → `students.json`** sync (manual now, automatic later — see engine plan).
6. **Hosting cutover (Pages → Cloudflare), before the 2026-07-02 privacy flip** — IN PROGRESS:
   - ✅ **Cloudflare Pages live** (`optivem-learn` project) — builds `generate-dashboard.mjs` (**model A**,
     not the commit model — see engine plan), serving at **`optivem-learn.pages.dev`**. Build env vars:
     `GITHUB_TOKEN` (read-only), `GITHUB_OWNER=optivem`, `GITHUB_REPO=hub`, `NODE_VERSION=20`.
   - ✅ **hub `dashboard.yml` switched to model A** (`a5a68f8`) — POSTs the CF deploy hook
     (`CF_DEPLOY_HOOK` secret) on every `auto-on-*` completion + 30-min safety net; GitHub-Pages deploy
     removed. Verified: ticket lifecycle → CF rebuild → dashboard updates.
   - ✅ **Custom domain `learn.optivem.com` LIVE** — CF Pages custom domain + CNAME at Bluehost
     (`learn` → `optivem-learn.pages.dev`); HTTP 200, valid TLS, serving the dashboard.
   - ✅ **Old URL redirect** (`ee2fa0b`, repointed `e437f45`) — `optivem.github.io/hub` serves a static
     "we've moved" page (Pages switched to branch `main`/`docs` deploy) → **`https://learn.optivem.com/`**.
     (Only serves until 2026-07-02 — Pages dies on Free+private.)
   - ✅ **Cloudflare Access LIVE (2026-06-12)** — GitHub IdP + Access app gating **both** hostnames; no
     longer public. Policy currently `Organizations → optivem`; tighten to the `optivem-students` team +
     populate the roster (see RESUME HERE → Next Actions A/B). Full setup notes + gotchas in RESUME HERE.
   - Gate Access with **GitHub IdP + the `optivem-students` team**, synced from `students.json`. **The team
     has NO repo access** — purely an identity group for Access (giving students hub repo access would leak
     other students' private data once hub is private). ✅ Team created 2026-06-12 (`optivem-students`, no
     repo permission, empty — populate from `students.json` at cutover).
   - ⚠️ **Incident (fixed):** adding the SHOP option via `sync-project --add` wiped the **Sandbox Project**
     field on all 48 tickets (the option-list rewrite recreated option IDs, orphaning item values) →
     dashboard went blank. Fixed: backfilled all 48 from issue titles, and patched `sync-project.mjs` to
     pass existing option **ids** so updates preserve values (`f1ad325` hub / school engine).
7. **Flip hub private (2026-07-02)** per the parked privacy plan. By then Cloudflare must be serving the
   dashboard (Pages would die). Verify the gated dashboard at `learn.optivem.com`.
8. **End-to-end verify on hub:** a real (or test) submission flows create → review → done; dashboard
   refreshes; Access gate holds.

## Risks & sequencing

- **hub is live and in use** — don't break it mid-migration. Prefer branch + PR + careful diff (step 4).
- **Cutover timing:** Cloudflare hosting must be live **before** hub goes private, or the dashboard goes
  dark (Pages stops on Free+private). Aim to complete steps 5–6 before 2026-07-02.
- **Don't let hub and school diverge:** port extras into school first (step 2) so `apply` stays clean and
  future engine updates propagate.
- **Access on a Bluehost-CNAME'd custom domain** — verify (fallback: delegate subdomain to Cloudflare).

## Decisions (LOCKED 2026-06-12)

1. **Target repo = `optivem/hub`.** Hub becomes *the* real Optivem School instance (real roster,
   courses, board #18); engine updates propagate in via `apply`. In-place upgrade, de-risked by the
   branch + PR dry-run (step 4).
2. **Port EVERYTHING into `school` — full superset (`school ⊇ hub`).** Port all hub extras, including
   ones currently dead/commented, so school is the complete source of truth and `apply` stays clean:
   - **Workflows:** `auto-on-edited` (assignee/milestone lockdown guard), `auto-on-deleted` (log),
     `nudge-unanswered-discussions`.
   - **Actions:** `add-assignee`, `remove-assignee`, `set-milestone` (used by `auto-on-edited`), plus
     `assign-issue` and `check-prerequisites` (currently commented out in hub's `auto-on-created` — port
     them too, kept dormant/commented, so school matches hub exactly).
   - Re-test each against `school-test`; harden any with the `${{ inputs }}`-inline injection bug.
3. **Access gating = GitHub IdP + `optivem-students` team.** Cloudflare Access uses GitHub as IdP;
   allow-list = `optivem-students` team members, synced from `students.json`. The team has **no repo
   access** (identity-only, to avoid leaking student data once hub is private). Named `optivem-students`
   (not `school-`) since "School" is the platform brand. Callback
   `https://optivem.cloudflareaccess.com/cdn-cgi/access/callback`.
4. **Custom domain = `learn.optivem.com`** (single domain — supersedes the earlier `school.`/`app.` split).
   Named for the activity (student-facing), pairs with `circle.optivem.com` (membership/brand). The v1
   dashboard and any future v2 live app share this one origin. CNAME at Bluehost → `<project>.pages.dev`.
   Must be live + Access-gated **before hub goes private 2026-07-02**.

## Relationship to other plans

- Builds on the engine from [`20260610-0927-optivem-school.md`](20260610-0927-optivem-school.md).
- **Aligns with the parked hub-privacy transition (2026-07-02)** — this migration is how hub keeps a
  working (now gated) dashboard once it can no longer use GitHub Pages.
