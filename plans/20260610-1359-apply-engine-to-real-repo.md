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
2. **Port ALL hub extras into `optivem/school`** (Decision 2 — full superset, `school ⊇ hub`):
   - `auto-on-edited` (assignee/milestone lockdown guard), `auto-on-deleted` (log),
     `nudge-unanswered-discussions`.
   - `add-assignee`, `remove-assignee`, `set-milestone`, plus `assign-issue` and `check-prerequisites`
     (port the latter two dormant/commented, matching hub). Generalize any hub-specific bits.
   - Re-test each against `school-test`; harden any still carrying the `${{ inputs }}`-inline bug.
3. **Backport the hardening** by virtue of step 2 + `apply`: hub's shared actions get school's
   env-based (injection-safe) versions, schema validation, reason-based reject, `init`/`sync`/`apply`,
   content-hash dashboard. (Hub has the same latent injection bug — low risk today since hub project
   names have no apostrophes, but fix it.)
4. **Dry-run the apply against a hub branch** (while hub is still public + low-stakes): `apply` the
   school engine onto a `school-engine` branch of hub, open a PR, diff carefully, run the workflows on
   the branch if possible. Do **not** disturb hub's real config (`apply` never touches `config/*.json`).
5. **Roster:** keep hub's real `config/` (students/reviewers/projects/courses, board #18). Wire the
   **Thinkific → `students.json`** sync (manual now, automatic later — see engine plan).
6. **Hosting cutover (Pages → Cloudflare), before the 2026-07-02 privacy flip:**
   - Stand up **Cloudflare Pages** for hub (build serves `docs/`), **Cloudflare Access** gating, and the
     **`learn.optivem.com`** custom domain (CNAME at Bluehost — see `sites/CONTRIBUTING.md` account-level
     DNS note).
   - Switch hub's `dashboard.yml` to the **Cloudflare-commit** model (school's version) and **remove the
     GitHub-Pages deploy**.
   - Gate Access with **GitHub IdP + a `school-students` team** (single sign-on + GitHub-username
     whitelist) — the deferred item; the team doubles as the repo-access list and can sync to
     `students.json`.
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
3. **Access gating = GitHub IdP + `school-students` team.** Cloudflare Access uses GitHub as IdP;
   allow-list = `school-students` team members. Team doubles as repo-access list and can sync to
   `students.json`. Callback `https://optivem.cloudflareaccess.com/cdn-cgi/access/callback`.
4. **Custom domain = `learn.optivem.com`** (single domain — supersedes the earlier `school.`/`app.` split).
   Named for the activity (student-facing), pairs with `circle.optivem.com` (membership/brand). The v1
   dashboard and any future v2 live app share this one origin. CNAME at Bluehost → `<project>.pages.dev`.
   Must be live + Access-gated **before hub goes private 2026-07-02**.

## Relationship to other plans

- Builds on the engine from [`20260610-0927-optivem-school.md`](20260610-0927-optivem-school.md).
- **Aligns with the parked hub-privacy transition (2026-07-02)** — this migration is how hub keeps a
  working (now gated) dashboard once it can no longer use GitHub Pages.
