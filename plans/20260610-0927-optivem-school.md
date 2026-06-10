# Optivem School — a GitHub-backed learning platform (new open-source product)

> **What it is:** **Optivem School** is a standalone, open-source, **self-installable** learning
> platform built on top of a GitHub repo. Teachers run guided practice; students learn by doing.
> Anyone can install it (via a public GitHub App) and point it at their own repo + roster.
>
> **Tenant #1 = Optivem itself:** `circle.optivem.com` (the *Optivem Circle* membership) becomes one
> skinned instance of Optivem School, pointed at `optivem/hub`. **Circle = the brand/membership;
> Optivem School = the platform that powers it.**
>
> This evolved from "a site that lists `optivem/hub` discussions." It grew into a full product, so it
> gets **its own repo, `optivem/school`** — not a page inside `sites/`. This file is the planning doc;
> once `optivem/school` exists, it migrates there.

---

## TL;DR

- **Product:** role-based learning platform. **Students** ask questions, submit **project review
  requests**, and view their **progress**. **Teachers** answer questions, **review** submissions, and
  mark **status → completed**. **Admins** manage people, roles, courses, and **enrollment**.
- **Backend data lives in GitHub:** Discussions (Q&A), submissions + review status (Issues / project
  board), courses (≈ Discussion categories), all in the tenant's repo (`optivem/hub` for Optivem).
- **Access is enrollment-scoped:** a user sees only the courses they're enrolled in. Authorization is
  three layers: **identity** (GitHub sign-in) → **role** (admin/teacher/student) → **enrollment**
  (which courses).
- **Shape:** static frontend (no framework, no build) + a small **serverless backend** (Cloudflare
  Pages Functions) that holds secrets, does GitHub auth, and talks to the GitHub API.
- **Auth:** a **single public GitHub App**, installed **once on `optivem/hub`** — reads private data
  via an **installation token**, identifies users via **"Sign in with GitHub."** It's **public only so
  external students can sign in** (a private app would limit sign-in to org members) — **not**
  multi-tenant: one installation, one deploy.
- **Cost:** effectively **$0** at this scale (Cloudflare free tier + free GitHub App).
- **v1 scope:** the mentorship loop — Q&A + project review + progress + enrollment gating. Lesson
  *content delivery* and posting/commenting in-app are deferred.

---

## Guiding principles

1. **Follow `optivem/hub`** — replicate how hub already models the learning process (config JSON →
   GitHub Issues + Projects v2 board → GitHub Actions automation → generated static dashboard). **Unless
   a genuinely cleaner / more natural solution exists** — in which case flag it in the plan, don't
   silently diverge.
2. **Token efficiency is a top-level constraint.** Prefer direct `Write`/`Edit` over agents; reserve
   subagents for broad read-only exploration where only the conclusion is needed (e.g. mapping hub).
   Don't re-read just-written files; batch independent writes; commit at clean checkpoints, not per file.
3. **The two lists are configurable per deployment** — students and teachers/reviewers are config a
   self-hoster edits (built on hub's `students.json` / `reviewers.json`). `optivem/school` ships **example**
   configs; each deployment supplies its own.
4. **Setup is idempotent / declarative (reconcile).** Config is the source of truth; onboarding converges
   GitHub to it — *check-exists-else-create, update-if-drifted, never duplicate*. Re-running any step is
   safe (`init` skips existing config; board setup reconciles fields/options; `sync` regenerates
   deterministically). Mirrors hub's `sync-project.mjs` reconcile model.

## Architecture alignment — what v1 actually is (and what's deferred)

**v1 = a generalized, configurable `hub`.** No live backend, no OAuth, no GitHub App, no secrets:

- **Config** (`config/*.json`) — students, reviewers, projects, board, courses (hub's exact shapes).
- **Submissions = GitHub Issues** via generated per-course issue templates → validated by Actions →
  added to a **GitHub Projects v2** board with a **Status** field (Open / In Progress / In Review / Done).
- **Automation = GitHub Actions** (validate, dedupe, add-to-board, set fields, status transitions).
- **Read surface = a generated static dashboard** (`generate-dashboard.mjs` → `docs/index.html`), like
  hub — but hosted on **Cloudflare Pages + Cloudflare Access** at `school.optivem.com`.
- **Q&A** = issue comments / tickets (hub's model); a Discussions layer is optional, not core.
- **Distribution = template repo** ("Use this template") — self-host without forking.

### Hosting & repo visibility (DECIDED)

- **Hosting = Cloudflare Pages + Cloudflare Access** (NOT GitHub Pages). Why: on the **Free** plan
  GitHub Pages won't serve a **private** repo; and the dashboard shows **private student data**, so it
  must be **gated**, not public. Cloudflare Pages serves the static dashboard from a private repo (free);
  **Cloudflare Access** (free Zero Trust, ~50 users) gates it to an allow-list by email/GitHub — **no
  custom auth code**. This is *cleaner than hub* (hub currently serves the dashboard on public GitHub
  Pages — a latent privacy leak once data is sensitive). Per-student scoping → v2.
- **Repo visibility:** **`optivem/school` stays PUBLIC** (the AGPL platform code/template, so others can
  self-host) · **`optivem/hub` goes PRIVATE** (the real student *data*). The dashboard reflects hub's
  private data → gated by Access.
- **Domain:** `school.optivem.com` for the v1 dashboard (reserve `app.optivem.com` for the v2 live app).
  No domain registration — add the custom domain in the Cloudflare Pages project + one **CNAME at
  Bluehost** (`school` → `<project>.pages.dev`). DNS stays at Bluehost; nothing registered on Cloudflare.
- ⚠️ **Verify at go-live:** Cloudflare Access on a Pages custom domain whose DNS is at Bluehost. Fallback:
  delegate the subdomain to Cloudflare, or gate via the v2 OAuth layer.

> ⚠️ **The Cloudflare Pages Functions + GitHub App + OAuth + role-aware live web app described in the
> "Architecture", "Authorization model", "Proposed repo layout", and "Steps" sections below are a
> DEFERRED v2 "live layer"** — only if a logged-in, real-time UI beyond the static dashboard is wanted.
> They are NOT part of v1. v1 needs none of it.

---

## Roles & capabilities (the product spec)

| Role | Can do |
|---|---|
| **Student** | Ask questions · submit a **sandbox/project review request** · view **their own project progress/status** — all scoped to their **enrolled courses** |
| **Teacher** | Answer questions · **review** submitted projects · update **status → completed** — for the courses they teach |
| **Administrator** | Manage people & roles · set up courses · manage **enrollment** (who's in which course) · assign teachers |

**Positioning:** this is a **structured learning platform** (guided practice + expert review), **not** a
casual community/forum. Q&A is *learning support*; the signature loop is **submit → review → complete**,
with progress tracked per student.

## How it maps onto GitHub (why GitHub is the backend)

| Product concept | GitHub primitive |
|---|---|
| Course | A set of **Discussion categories** (+ a project board). `optivem/hub` already has per-course categories (e.g. *ATDD Accelerator Course*). |
| Ask / answer a question | **Discussions** (Q&A category) |
| Submit a project review request | A submission tied to the student's repo — a **Discussion** in a "Reviews" category or an **Issue** (mirrors `optivem/hub`'s submission-guide + reviewers flow) |
| Review + status → completed | Teacher comments + a **status field on an Issue / Project board** (To do → In review → Completed). `optivem/hub` already has `board.json` / `projects.json`. |
| View progress | The student's items on that board, filtered to them |
| Roles & enrollment | Config lists (`students.json`, `reviewers.json` exist) and/or **GitHub Teams**; enrollment = `student → courses` map |

So Optivem School **productizes the `optivem/hub` mentorship model** — generalized, role-aware, branded,
and installable by anyone.

## Architecture

- **Frontend:** static HTML/CSS/JS, same no-framework idiom as `sites/`. A role-aware SPA-lite: it
  asks the backend "who am I + what can I see" and renders the right surfaces.
- **Backend:** **Cloudflare Pages Functions** (`functions/`) — holds secrets, runs GitHub auth, proxies
  the GitHub GraphQL/REST API, and enforces **role + enrollment** authorization server-side. (Not a
  static-only site: OAuth needs a server-side secret exchange, and authorization must not be
  client-trusted.)
- **Auth → a single public GitHub App** (registered under `optivem`, installed once on `optivem/hub`):
  - **Public** (not private): confirmed from GitHub docs — a *private* GitHub App can only be authorized
    by the owning org's members, so external **students couldn't "Sign in with GitHub."** That is the
    *only* reason it's public. It is **not multi-tenant** and not a hosted SaaS — one installation, one
    deploy. "Public" is harmless: the backend reads only via **our own installation** (by Installation
    ID), so the app's existence being installable by others gives them no access to `optivem/hub`.
  - **Two flows:** *user-to-server* ("Sign in with GitHub") for **identity only**; *installation token*
    (minted from the App private key via JWT, ~1 h, cached) for the **private read/write** of repo data.
  - **Permissions:** `Discussions: read` + `Metadata: read` for v1 (add `Discussions: write` / `Issues`
    when in-app posting + review-status writes land).
- **Single-tenant deployment:** configured once with the repo (`optivem/hub`), Installation ID, the
  course→category map, and the roster source. Served at **`app.optivem.com`**.
- **Others run their own (self-host via template — NOT a fork, NOT SaaS):** `optivem/school` is a
  **GitHub template repo**. Someone else clicks **"Use this template"** (or a "Deploy to Cloudflare"
  button) → gets a **fresh, independent repo** (no fork link) → registers **their own** GitHub App →
  points it at **their own** repo → deploys to **their own** Cloudflare. Their instance is fully theirs
  and single-tenant. **You host only your own** (`optivem/hub` → `app.optivem.com`) and operate nothing
  for anyone else. AGPL guarantees they always have the source to do this.

## Authorization model (the heart of the product)

On every request the backend resolves, server-side:
1. **Identity** — valid signed session cookie (minted at GitHub sign-in). Reject if absent.
2. **Role** — look up the GitHub `login`/`id` → `admin` | `teacher` | `student` (config or GitHub Team).
   Reject if not a known member.
3. **Enrollment** — the set of courses this user may see (students: enrolled courses; teachers: taught
   courses; admins: all). **Every data query is filtered to this set** — a student can never see a
   course they're not enrolled in, even by guessing a category/issue id.

The GitHub installation token is powerful (reads the whole repo), so **the backend is the only thing
that touches it** and it is **never** exposed to the browser; the browser only ever gets the
already-filtered result.

## Proposed repo layout (`optivem/school`)

```
public/                      # static frontend (no build)
  index.html                 # role-aware shell
  assets/{app.css, app.js}
functions/                   # Cloudflare Pages Functions (backend)
  auth/{login,callback,logout,me}.js
  api/
    questions.js             # list/answer Q&A (enrollment-scoped)
    reviews.js               # submit / list / review project requests + status
    progress.js              # a student's items + statuses
  lib/
    installation-token.js    # App private key (JWT) → cached installation token
    authz.js                 # identity → role → enrollment resolution + filtering
    github.js                # GraphQL/REST helpers
  _middleware.js             # gate /api/* on a valid, authorized session
config/
  tenant.example.json        # repo, installation id, course→category map, roster source
README.md                    # what it is, how to self-install
LICENSE                      # AGPL-3.0 (decided)
CONTRIBUTING.md + CLA        # contributor agreement → preserves freedom to dual/relicense later
```

## Steps (high level)

1. **Create `optivem/school`** — ✅ **DONE** (public, AGPL-3.0, README + `.gitignore`):
   https://github.com/optivem/school. Next: **Valentina clones it via GitHub Desktop** into the academy
   workspace; once cloned, **move this plan into `optivem/school`** and continue building there. Later
   (once the scaffold exists): mark it a **template repo** (`gh repo edit optivem/school --template`) and
   add a **"Deploy your own"** section to the README (Use-this-template + Deploy-to-Cloudflare button) so
   others can self-host without forking.
2. **Register the GitHub App** (`optivem` org → Developer settings → GitHub Apps): **public**,
   `Discussions: read` + `Metadata: read`, callback = the app origin's `/auth/callback`, generate
   private key. **Install on `optivem/hub`.** Store App ID / Client ID+secret / private key (PEM) /
   Installation ID as **Cloudflare env vars** — never committed. *(Manual; ask the user — do not create
   secrets autonomously.)*
3. **`lib/installation-token.js`** — JWT → installation access token, cached (~1 h).
4. **Auth flow** — `auth/login.js` (→ GitHub user-authorization, random `state`), `auth/callback.js`
   (verify `state`, exchange `code`, fetch `/user`, resolve **role + enrollment**, reject non-members,
   set signed httpOnly/Secure/SameSite session cookie), `auth/logout.js`, `auth/me.js`.
5. **`lib/authz.js`** — identity → role → enrollment resolution + per-course filtering; `_middleware.js`
   gates `/api/*`.
6. **`api/questions.js`** — list Q&A from the enrolled-course categories; (write/answer deferred to a
   later phase once `Discussions: write` is added).
7. **`api/reviews.js`** — student submits a review request; teacher lists + reviews + sets status.
   (Phase 1 may start **read-only**: surface existing submissions/statuses, with submit/review
   following once write scope is added — see phasing.)
8. **`api/progress.js`** — a student's items + statuses across their enrolled courses.
9. **Frontend** — role-aware UI: sign-in; student view (ask, submit, my progress); teacher view
   (answer, review queue, mark complete); admin view (people/roles/courses/enrollment). Styled in the
   Optivem theme.
10. **Tenant config + deploy** — fill `config/tenant.json` for Optivem (`optivem/hub`), wire the
    Cloudflare Pages project + subdomain, deploy.
11. **Verify** — `wrangler pages dev` locally: sign in as student (sees only enrolled courses), as
    teacher (sees review queue, can set status), as non-member (denied, no leakage); confirm tokens
    never reach client JS; confirm logout. Then verify on the deployed subdomain.
12. **GitHub API errors fail loud** — never silently return empty on auth/5xx (mirrors the repo rule
    "check-* actions must not swallow errors").

## Phasing

- **v1 (this plan):** sign-in + **role + enrollment gating**; **read** surfaces — Q&A list, review
  queue + statuses, student progress — all enrollment-scoped. Single-tenant against `optivem/hub`.
- **v2:** **write** from in-app — ask/answer questions, submit a review request, teacher sets status —
  via `Discussions: write` / `Issues` on the GitHub App. (Until then, writing happens on GitHub
  directly; the app reflects it.)
- **v3+:** lesson/**content delivery** (lessons rendered from the repo), webhooks for live refresh,
  dashboards, search.
**Explicitly OUT of scope — multi-tenant SaaS / hosting others.** We are **not** building a hosted
service where others install the app and Optivem runs their school. Others get their own school by
**self-hosting from the template** (above). Optivem hosts **only its own** instance. (Decided.)

## Data & persistence (GitHub-first; Cloudflare DB if needed)

**GitHub is the source of truth** for content — questions, answers, submissions, review status, courses
(Discussions / Issues / project board). Most of the app needs **no separate database**.

If a real database *is* needed (for things GitHub doesn't model well — enrollment maps, role
assignments, sessions, caches, audit logs), **stay on Cloudflare — same platform, same ~$0 tier:**

- **Cloudflare D1 = serverless SQLite.** This directly answers "can I use SQLite?" — D1 *is* SQLite-as-a-
  service, bound straight into Pages Functions. Use it for relational data (enrollment, roles, sessions).
  Free tier: generous (millions of reads/day).
- **Cloudflare KV** — key/value store; ideal for sessions, simple lookups, and **caching** (e.g. cache
  the installation token or a discussions list). Eventually consistent.
- **Durable Objects** — strongly-consistent stateful coordination (real-time, per-entity locks) — only
  if v3+ needs it.
- **R2** — S3-compatible object storage for file attachments.
- **Hyperdrive** — if you ever want a *full external Postgres/MySQL*, this pools the connection from
  Workers. (Overkill here; D1 covers it.)

**Recommendation:** start with **no DB** (GitHub + the tenant `config/`), and reach for **D1 (SQLite)**
the moment you need real relational persistence — it keeps everything on Cloudflare and free.

## Cost

Effectively **$0** at this scale, on top of the domain you already own:
- **Cloudflare Pages** (static): free — unlimited requests/bandwidth, free custom domain + TLS.
- **Cloudflare Pages Functions** (backend): Workers free tier = **100,000 requests/day**. Far beyond a
  cohort's usage. If ever exceeded, **Workers Paid = $5/mo** (10M req/mo).
- **GitHub App:** free.

## Decisions & remaining open questions

**Decided:**
- **App home → `app.optivem.com`** (dedicated subdomain, clean security boundary). Callback =
  `https://app.optivem.com/auth/callback`.
- **License → AGPL-3.0** + a **CLA** (so contributions don't block a future dual/commercial license).
- **Repo → public from the start.**
- **Auth → single public GitHub App, one install on `optivem/hub`** (single-tenant; public only for
  external student sign-in).
- **Roster / role / enrollment → Thinkific is the source of truth.** **v1: Valentina manually syncs a
  config file** (in `optivem/hub`'s `config/`, building on `students.json` / `reviewers.json`).
  **Future: automatic Thinkific integration** (API sync of enrollments → config or D1). Backend reads
  the config; swapping in a live Thinkific sync later doesn't change the authz layer.

**Still open (not blocking v1):**
- **Submissions = Issues or Discussions?** Issues give a native status field + project board; a
  "Reviews" Discussion category keeps everything in one surface. Decide the `reviews.js` backing model.
- **Cloudflare Pages root** for `optivem/school` and confirming Functions are enabled.

## Relationship to existing plans

- Supersedes the discussion-reader framing in this same dated slot (the file was renamed from
  `…-optivem-circle-app.md`).
- Implements the **"Community layer"** parked in
  [`deferred/20260608-1118-optivem-circle-future.md`](deferred/20260608-1118-optivem-circle-future.md)
  — but as a **structured learning platform** on GitHub, not a Slack-style channel.
- **Circle stays the brand/membership**; `circle.optivem.com`'s marketing page is unchanged. Optivem
  School is the *platform* it runs on.
