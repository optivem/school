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
   - ⏭ **Remaining (you, in Cloudflare):** set up **Cloudflare Access** on `learn.optivem.com`
     (+ `optivem-learn.pages.dev`) — GitHub IdP + `optivem-students` team. ⚠️ `learn.optivem.com` is
     currently **public + ungated** (shows student data) until Access is applied.
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
