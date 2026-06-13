# Optivem School: own e-learning platform — build plan (D1-backed, replaces Thinkific)

> Follow-up spun out of [`20260610-1359-apply-engine-to-real-repo.md`](20260610-1359-apply-engine-to-real-repo.md)
> and the engine plan [`20260610-0927-optivem-school.md`](20260610-0927-optivem-school.md).
> **Status: DECIDED — building.** Started as a "GitHub-as-DB vs proper DB" decision plan; it answered itself
> and grew into a **full single-tenant e-learning platform** (courses, in-portal reviews, Q&A, community,
> live events, coaching, billing, admin). **3 roles + public**, on Cloudflare (Access/app-auth + Pages
> Functions + D1 + Stream). UI mockups (**12 frames**): [`mockups/learn-portal-mockup.html`](mockups/learn-portal-mockup.html).
> **Two pricing items still to confirm:** (1) Circle = all-access-scoped-to-owned-courses; (2) review cap.

## What changed — why this is now a build, not a question

The parked version of this plan asked "stay on GitHub-as-DB, or move to a proper DB?" and the answer hinged
on one open question: *is there a concrete v2 app, and what does it need?* That question is now answered.

The v2 is a **student-facing portal** with these requirements, each of which GitHub structurally can't meet:

| Requirement | GitHub-native? | Why it forces a custom app + DB |
|---|---|---|
| Sandbox **code reviews** | ❌ **(decided: NOT PRs)** | Reviews happen **in-portal** — student connects their **own repo** (read-only via a GitHub App) and submits; you review inline. No PRs, no click-out (same reasons as everything else). |
| **Q&A** per course | ❌ | A **shared per-course board** (shared with the cohort; a **Circle** subscription feature). Discussions visibility is repo-level all-or-nothing; categories aren't access control. |
| **Per-course gating** | ❌ | A student sees only the courses (Q&A, lessons, events) they're **enrolled** in. |
| **GitHub _and_ Google login** | ❌ | Anything GitHub-native strands Google-login students. |
| **One place — no click-out** | ❌ | Dashboard-then-separate-links is the deciding pain. Discussions/PRs/Thinkific are *separate destinations* — they add links, they don't remove them. |

These are things **only a custom app + DB** does cleanly, and "one unified surface" rules out every
buy-it-elsewhere option. So this is no longer "GitHub-as-DB vs DB" — it's **build the portal**, backed by
**Cloudflare D1**.

> **Two corrections locked in after review (2026-06-13):** (1) **Reviews are in-portal, NOT GitHub PRs.**
> (2) **Q&A is a _shared_ per-course board** (gated by enrollment, visible to all enrolled students — one
> answer helps the whole cohort), *not* a private per-student inbox.

## The unlock — the build is smaller than it sounds

**Cloudflare Access already does login.** We do *not* build OAuth, sessions, or passwords:

- Access already gates `learn.optivem.com` with **GitHub** (live). **Add Google as a second IdP** → students
  get both buttons, pick either.
- Access hands every request a **signed JWT** (`Cf-Access-Jwt-Assertion` header) carrying the **verified
  email + IdP**. The app reads that, looks the student up in D1, and renders only their enrollments.
- Login = solved, multi-IdP, free, **zero auth code**. The IdP choice is irrelevant to access because the
  allow-list matches on **roster email** (see below), not GitHub-team membership.
- ⚠️ This is the right gate **for the interim private dashboard**. When it becomes a *public* paid product,
  move to **app-level auth** — see the **Auth** section below.

So the two scariest parts — **login** and **hosting** — already exist. What's left is **D1 + a few Pages
Functions + the UI**. Same origin, same gate as today's dashboard.

## Architecture

```
                 Cloudflare Access  (GitHub | Google IdP, allow-list = roster email)
                          │  signed JWT: { email, idp }      [interim gate — see Auth section]
                          ▼
   learn.optivem.com  =  Cloudflare Pages + Functions  ──reads/writes──▶  Cloudflare D1 (the spine)
        (portal UI)            (identity → D1)                  students, courses, enrollments, sandboxes,
                                      │                         questions, answers, reviews, events, …
                                      └── Stream (video) · Stripe (payments) · Circle (live stream)
```

- **Everything students touch lives in the portal — nothing is a click-out:**
  - **Reviews** = **in-portal** (D1). Student submits a sandbox; you review **inline** (status +
    comments-on-code), request changes / approve. **Not GitHub PRs.** *(Open: does the code itself still live
    in a Git repo the student pushes to — reviewed in-app — or is it submitted/uploaded? See open questions.)*
  - **Q&A** = **shared per-course board** in D1 (`questions`/`answers`, `course_id`-scoped, visible to all
    enrolled). Per-course gating = one `WHERE`.
  - **Lessons/video** = Cloudflare Stream (signed playback); **live events** = surfaced from Circle.
  - **Progress** = today's dashboard data.
- **Allow-list flips from GitHub-team → roster email** (synced from `students.json` / Thinkific). Then either
  IdP works and the team becomes optional.

## D1 schema (first cut)

```sql
-- people & roles
users(id, email, display_name, github_login, role, org_id, created_at)   -- role: student | teacher | admin
organizations(id, name, vat_id, billing_account_id, seats)       -- B2B group signup needs an org NAME
enrollments(student_id, course_id, status, source, enrolled_at)  -- per-course gate; source: paid | comp | group
memberships(student_id, tier, status, started_at)                -- tier: circle → unlocks reviews + live events
course_teachers(course_id, teacher_id)                           -- admin assigns teacher(s) to a course

-- catalog (configured by ADMIN)
courses(id, slug, name, price, published)
lessons(id, course_id, module_no, title, body_md, stream_video_id, duration_s, order)  -- body_md = Markdown
sandbox_specs(course_id, project_key, instructions_md)           -- sandbox INSTRUCTIONS (visible to all enrolled)

-- shared per-course Q&A (TEACHER-answered)
questions(id, course_id, lesson_id, author_student_id, title, body_md, status, upvotes, created_at)
answers(id, question_id, author_id, body_md, is_instructor, created_at)

-- in-portal reviews (CIRCLE members only; NOT GitHub PRs)
sandboxes(id, student_id, course_id, provider, repo_url, gh_installation_id, connected_at)  -- their OWN repo
review_submissions(id, sandbox_id, commit_sha, title, attempt, state, submitted_at)
review_comments(id, submission_id, author_id, body_md, is_instructor, file, line, created_at)

-- community forum (PEER-to-peer, everyone auto-joins, FREE)
community_posts(id, author_id, category, title, body_md, likes, created_at)
community_replies(id, post_id, author_id, body_md, likes, created_at)

-- direct messages: student↔student FREE; student↔instructor GATED (high rung / coaching)
dm_threads(id, a_user_id, b_user_id, kind, created_at)            -- kind: peer | instructor
dm_messages(id, thread_id, author_id, body_md, created_at)

-- live events (stream + Miro stay external; rolling backlog here)
events(id, title, starts_at, kind, status, recording_video_id)    -- kind: group_live | coaching_1on1
event_questions(id, author_student_id, body_md, upvotes, status, target_event_id, created_at)  -- rolling; target set on triage

-- coaching (top rung — unlimited situational Q&A, 1:1 sessions, capacity-limited)
coaching_seats(student_id, status, started_at)                    -- limited spots
coaching_questions(id, student_id, body_md, status, created_at)   -- UNLIMITED, situational (vs course Q&A = limited)

-- pricing / entitlements (Stripe is source of truth — invoices NOT stored here)
products(id, kind, name, stripe_price_id)                         -- kind: course_onetime | circle_sub | coaching_sub
subscriptions(id, student_id, product_id, tier, status, current_period_end)  -- circle (all-access) | coaching
billing_accounts(id, owner_id, kind, company, vat_id, stripe_customer_id)    -- kind: individual | b2b
```

- **`body_md` everywhere is Markdown**, rendered with **one pipeline** — markdown-it/remark + **Shiki** (code
  highlighting) + **DOMPurify** (sanitise user input). Same renderer for **lesson content, Q&A, reviews,
  community**. (Proper code highlighting in *lesson content* is something **Thinkific can't do** — a real edge.)
- **Video** never stored by us — D1 holds the **Stream video ID**; the file lives in Cloudflare Stream.
- **Reviews are in-portal:** the student connects their **own repo** (`sandboxes`, read-only via a **GitHub
  App** install) → a `review_submission` per attempt pulls a `commit_sha` → you leave `review_comments`
  (optionally pinned to `file`/`line`). **No `pr_url`, no GitHub PRs.**
- **Entitlements (priced by your time — see Pricing & the value ladder):**
  - **Community** = **FREE / open to anyone** (no purchase). Not enrollment-gated.
  - **Enrollment** (owning a course) = the **content** (video + text) + viewable sandbox **instructions**.
  - **Circle subscription** = the *time-based* support: **Q&A** (fair-use / "limited") + **reviews** (capped)
    on courses you own, **plus** membership-wide **live group sessions**. **⚠️ Q&A is Circle, NOT bundled
    with enrollment.** Live events are **not** per-course.
  - **Coaching** = **unlimited situational** Q&A + live **1:1** (capacity-limited).
- **Rolling event backlog:** `event_questions` aren't tied to an event on submit — `target_event_id` is set
  when you triage the top-voted into whichever event is next.
- **Billing:** D1 stores only `stripe_customer_id` + editable B2B details mirror; **invoices live in Stripe**.

The **spine** (enrolment, sandbox↔student↔course, submission state) migrates off board #18 **incrementally**:
mirror into D1 first, flip canonical once the portal renders from D1. **Board #18 can stay as your private
kanban** — it's just no longer what students touch.

## Roles, tiers & surfaces (the full product map — see all 12 mockup frames)

This grew over the design session from "a portal" into **a full e-learning platform**. The complete map:

**Roles** (`users.role`): **public** (not logged in) · **student** · **teacher** · **admin/owner**.

**Tiers / entitlements — see the full pricing model in [Pricing & the value ladder](#pricing--the-value-ladder):**
- **Free** — **community** (peer forum, open to anyone, no purchase) + sandbox *instructions* are viewable.
- **Course** (one-time, per course) — lesson **video + text** content. The asset; yours forever.
- **Circle** (one subscription, all-access **scoped to owned courses**) — adds the *time-based* support:
  **Q&A** (fair-use) + sandbox **reviews** (capped) **on the courses you own**, **plus** membership-wide
  **live group sessions** (stream + Miro). (NB: Q&A/reviews are **subscription**, not bundled into the course
  price. **Live events are NOT per-course** — they're a membership-wide benefit, cross-course.)
- **Coaching** (separate, capacity-limited) — **unlimited situational** advisory + live **1:1**. The top rung.

**Surfaces:**
| # | Surface | Role | Notes |
|---|---|---|---|
| 12 | **Course landing page** | public | Marketing/SEO funnel → checkout. No gate. **⟹ public product wants app-level auth.** |
| 05 | **Checkout** | public→student | Stripe + Stripe Tax + **Taxually** (already yours, not TCommerce). B2C + B2B (org name + VAT reverse-charge). |
| 01 | **Login** | all | GitHub + Google. Access gate is the *interim*; app-level auth for the public product. |
| 02 | **My Courses** | student | Auth-scoped to enrolments. |
| 03 | **Course detail** | student | Tabs: Progress · **shared Q&A** (teacher-answered, **Circle**) · **in-portal reviews** (**Circle**) · sandbox **instructions** (all enrolled). No events tab (events aren't per-course). |
| 04 | **Lesson** | student | **Stream video + Markdown text** with **Shiki** highlighting (Thinkific can't). |
| 06 | **Live events** | Circle | **Membership-wide, NOT per-course.** Stream **+ Miro** board; **rolling** backlog (triaged into the next event). |
| 07 | **Account / billing** | student | Invoices (from Stripe) + editable **B2B details** (company, VAT ID). |
| 08 | **Community** | **free / all** | **Peer-to-peer**, freestyle, **free & open to anyone** (replaces current chat), your reply optional. Includes **DMs** (peer↔peer free; DMing you is gated). |
| 09 | **Work queue** | teacher | Questions awaiting answer + reviews awaiting feedback + event triage. |
| 10 | **Admin** | admin | Configure **teachers**, **courses**, **comp/ad-hoc students**, **B2B orgs**. |
| 11 | **Course designer** | admin/teacher | Course → **modules → lessons**, each lesson = **video + Markdown text**. Replaces Thinkific's builder. |

**One Markdown pipeline everywhere** (lesson text, Q&A, reviews, community): markdown-it/remark + **Shiki**
(code highlighting) + **DOMPurify** (sanitise). **External pieces kept** (hardest to build, least core):
**Circle** (live stream) + **Miro** (whiteboard) for events — surfaced inside the portal so it feels unified.

## Pricing & the value ladder

**Decision principle: price by how _scalable_ the time is.** The course is a made-once asset (sell forever);
support is your ongoing time, priced by how many people one unit of it serves.

**The ladder (ascending price = ascending _your_ time per person):**

| Rung | Offering | Time type | Pricing |
|---|---|---|---|
| 0 | **Community** | peers, ~0 of your time | **Free** (open to anyone — replaces the current chat tool) |
| 1 | **Course** | none (made-once asset) | **One-time, per course** |
| 2 | **Circle · group chat / async Q&A** | group, async — scalable | ↓ lower rung of the **bundled** subscription |
| 3 | **Circle · live group sessions** | live, one-to-many | ↑ higher rung |
| 4 | **Coaching · live 1:1** | your calendar — unscalable | **Separate, capacity-limited**, highest price |

**Decisions:**
1. **Circle = ONE subscription, "all-access scoped to owned courses" (LEANING — confirm).** Not a separate
   sub per course (fragmented, low LTV) and not the whole catalog (you'd be paying for unbought courses).
   Instead: buy each **course** once; **one Circle sub** provides support (Q&A, reviews, live group) on
   **whatever courses you own**, extending automatically as you buy more. Simple + fair + high-LTV. *(The
   deciding question: is Circle support about the curriculum/mentorship → all-access, or one course's
   exercises → per-course? Reviews + live events aren't course-bound, which leans all-access.)*
2. **Bundle the scalable time; meter the unscalable time (LOCKED).** Group/async support (Circle) is bundled
   because it leverages. 1:1 advisory (Coaching) is **metered** (limited spots) — selling unlimited access to
   your personal calendar cheaply is the solo-creator burnout trap. "Support about anything" is fine for Circle
   *within the curriculum*; "advise me on *my* proprietary situation" is Coaching by definition.
3. **Customer-facing packaging:** **Course** / **Course + Support** (Circle) / **Course + Coaching** (1:1),
   plus a **Teams (B2B)** option. Community is the free rung beneath all of them.
4. **Q&A vs reviews — same bundle, meter the expensive one (don't split into separate SKUs).** A review costs
   far more of your time than a Q&A reply (which compounds for everyone). Keep both inside Circle, but **Q&A =
   fair-use / unlimited, reviews = capped** (e.g. N/month or N per course). SKU sprawl hurts conversion; a
   usage cap meters your priciest scalable time without a new product. Keep the entitlement design open so
   reviews *could* graduate to a higher Circle rung later if demand shows you're under-charging.

**DMs.** Student↔student DMs = **free** (community, zero cost to you). Student↔instructor DMs = **gated** (a
high-rung Circle perk or Coaching only) — open instructor DMs = unbounded unpaid support.

## Build steps (incremental — ships value early, no big-bang cutover)

1. **Add Google as a second Access IdP** + flip the allow-list to **roster email**. (~15 min, no code.)
   Verify GitHub *and* Google login both reach the dashboard.
2. **Stand up D1** + the schema above. Seed `students`/`courses`/`enrollments` from `config/*.json`.
3. **Turn the static dashboard into a Pages app**: add Pages **Functions** that read the **Access JWT
   identity** → query D1 → render the auth-scoped **My Courses** home (only my enrollments).
4. **Shared Q&A in D1** — per-course board: any enrolled student posts a question, the whole cohort sees it,
   you answer inline (`is_instructor`), upvotes surface the useful ones. The first genuinely *new* capability.
5. **In-portal reviews** — `review_submissions` + `review_comments`: student submits a sandbox attempt, you
   review inline (status + comments-on-code, request changes / approve), they resubmit. **No GitHub PRs.**
6. **Migrate the spine** — mirror board #18 enrollment/submission state into D1; once the portal reads D1 for
   everything, flip D1 canonical. Keep board #18 as the private admin kanban if wanted.
7. **End-to-end verify** — a student logs in (GitHub *or* Google) → sees only their courses → reads the shared
   course-A board (and cannot see course B) → submits a sandbox → you review inline → they resubmit.
8. **Lessons (video + text)** — `lessons` with Stream video + Markdown `body_md` rendered via the one pipeline
   (markdown-it + **Shiki** + DOMPurify). **Connect-repo** flow for reviews (GitHub App, read-only on the
   student's own repo); submission pulls a `commit_sha`. **Circle-membership gate** on reviews + events.
9. **Community** (`community_posts`/`replies`) — peer-to-peer forum, everyone auto-joined. **Account/billing**
   page — Stripe invoices + editable B2B details (start with Stripe's hosted Customer Portal, then native).
10. **Teacher work queue** + **admin** (configure teachers, courses, comp/ad-hoc students, B2B orgs) +
   **course designer** (modules → lessons, video + text). All role-gated on `users.role`.
11. **Live events** — surface Circle stream + **Miro** board + the **rolling** question backlog (`events` /
   `event_questions`, `target_event_id` set on triage).
12. **Public course landing pages** — the marketing funnel → checkout. At this point the product is public, so
   **move login from the Access gate to app-level auth** (Auth.js / Clerk / Supabase Auth, GitHub + Google).

## The bigger picture — this becomes your own e-learning platform (Thinkific retires)

The portal isn't the ceiling. The end state is a **real, single-tenant e-learning web app** (hardcoded to
Optivem — no multi-tenancy/marketplace, which keeps scope small) that *actually gets used* (unlike the SHOP
sandbox) and **absorbs everything Thinkific does today**. Two pieces complete that:

- **Video — Cloudflare Stream.** Don't self-host. Stream gives per-minute pricing, adaptive bitrate, a player,
  and **signed playback tokens** that gate on enrollment via the same Access identity. Embed a `<stream>`
  element per lesson. (Mux / Vimeo OTT are alternatives; Stream is the native fit.) Mockup frame 04.
- **Payments — already your own, B2C + B2B (DECIDED: Stripe direct).** You **already bill via Stripe
  directly, with Stripe Tax + Taxually — NOT Thinkific TCommerce.** So payments are *already off Thinkific*.
  - **Stripe** = payments; **Stripe Tax** = calculates + collects correct VAT per country incl. **EU B2B
    reverse-charge** (valid VAT ID → €0 VAT); **Taxually** = registers, files & remits returns across
    jurisdictions. You're the Merchant of Record, but the compliance is fully tooled by what you own.
  - **No Merchant-of-Record (Paddle / Lemon Squeezy) needed** — its whole value (offloading VAT
    registration/filing) is already covered by Taxually; it would just add ~5% to duplicate that.
  - Still needed: sell via the Optivem company entity, ToS + refund policy, GDPR (in hand), PCI (covered by
    Stripe Checkout/Elements). Mockup frame 05. ⚠️ *Not legal/tax advice.*

**Retire Thinkific progressively, never big-bang.** Payments are **already** independent (Stripe + Taxually),
so Thinkific is *already* reduced to **course content + video hosting**. Remaining path: portal adds Q&A +
in-portal reviews → absorbs **video** (Stream) → absorbs **content/authoring** → drop Thinkific once covered.
Each step is independently shippable and reversible.

## Optivem Circle — live events + question backlog (keep Circle, surface it in the portal)

Circle (`circle.optivem.com`) is the community/membership brand, with **live events** + a **question backlog**
for them (students submit + upvote questions; you triage them live, marking answered/skipped — an AMA queue).

**Decision: Circle is the one third-party worth _keeping_** (unlike Thinkific). Live video events (streaming,
real-time chat, attendance) are the **hardest** thing to build and the **least core** to your edge (your edge
is reviews + Q&A + courses). Rebuilding that is a bad trade.

**Hybrid (recommended):** keep the **live stream on Circle**, but **surface it inside the portal** — show
upcoming events + the **question backlog** in `learn.optivem.com` so it feels like one product (kills the
click-out). The backlog (`events` / `event_questions`) can live in D1 tied to course context; the live video
stays on Circle. Mockup frame 06. *(Distinct from the per-course Q&A board, which is course content, not events.)*

## Platform decision — all-in on Cloudflare (justified from scratch, not just because it's already there)

**Verdict: build the whole app on Cloudflare** — Pages/Workers (compute) + D1 (DB) + Stream (video) + R2
(files) — with **Stripe** (+ Stripe Tax + Taxually) for payments (cloud-agnostic, already in place). This
holds *even ignoring* what's already wired up.

**Why not AWS/GCP?** They're the wrong *bracket* for this app, not just a different vendor:
- AWS/GCP are **general-purpose datacenter clouds** — 200+ services, built for *anything* incl. data
  warehouses, GPUs/ML, Kubernetes, big enterprise back-ends. This app needs **none** of that.
- Most of their dominance is **incumbency + breadth + enterprise gravity** (AWS since 2006; "nobody gets
  fired for choosing AWS"), and a lot of "websites on AWS" are legacy always-on servers — *not* a verdict
  that they fit a solo, bursty, video-heavy LMS.
- For a one-person product they mean **more ops, more moving parts, and egress bills**.

**Why Cloudflare wins *for this specific app* (each reason survives a greenfield start):**
- **Egress economics — the deciding factor for a _video_ product.** Video delivery is overwhelmingly
  bandwidth. AWS S3 / GCP GCS charge **~$0.08–0.09/GB egress**; **Cloudflare R2/Stream charge $0 egress.**
  For a business whose core asset is streamed video, that's structural, not a tie-breaker.
- **Lowest ops for a solo founder** — managed serverless primitives, nothing always-on to patch/restart.
- **One coherent stack** — Pages + D1 + Stream + R2 share one dashboard, one bill, one identity model.
- **Cloudflare's origin _is_ a global edge network** (CDN/security in 300+ cities) — running code close to
  users is its core competence; AWS/GCP run in regions you pick.

**The genuine alternative** (not AWS/GCP) is **Next.js on Vercel + Supabase + Mux + Stripe** — also excellent,
smoother if you go all-in on Next.js, but Vercel passes through bandwidth and can get pricey. The video-egress
math breaks the tie toward Cloudflare. **When you'd actually reach for AWS/GCP:** heavy background jobs,
ML/GPUs, a data warehouse, or huge managed Postgres — none on this roadmap. (Many sites also run *on* AWS and
put Cloudflare *in front* for CDN/security — they overlap at the edge.)

**What "serverless" means and why it fits:** you write small functions ("when a request hits `/courses`, run
this"); the platform spins them up on demand, **auto-scales** under load, and **scales to zero** when idle —
you don't rent/patch/babysit an always-on server. Taxi, not a car you own. For a **solo-run, bursty**
(quiet nights, spikes on a lesson drop) app, that means **low cost + near-zero ops**. Caveat: functions are
short-lived — long jobs like *video transcoding* go to a specialist (Stream), not your functions.

> **Escape hatch:** D1 is a young, lightweight SQLite engine (~10 GB/db limit). If the spine ever outgrows it,
> swap **only the DB** to **Neon / Supabase Postgres** (serverless, works fine from Workers) — a component
> swap, not a platform migration. Unlikely at single-instructor scale.

## Auth — Access now (interim), app-level auth for the public product (reconsideration)

Two honestly-different phases:
- **Now / interim:** the dashboard is a **private internal tool** gated to enrolled students → **Cloudflare
  Access** (GitHub + Google IdP, roster-email allow-list) is the right tool: a zero-code SSO gate. Build
  step 1 still stands.
- **Later / the real product:** once this is a **public commerce app** (strangers land on a pricing page,
  sign up, *pay*, then get gated content), Access (a Zero-Trust gate for *known* identities) is the wrong
  primitive. Switch to **app-level auth** — **Auth.js / Clerk / Supabase Auth** with GitHub + Google
  providers and sessions in D1/Postgres. This is the natural home for public signup + paid enrollment.

So: **don't over-anchor on Access.** It's the correct *interim* gate for the current private dashboard; the
public product wants app-level auth. The D1 `students` table + roster-email model carries across both.

## Effort, cost & estimate (build vs staying on Thinkific)

**Headline: this is NOT a cost-saving move — it's a product/ownership investment.** Monthly savings vs
Thinkific are small; the payoff is the capabilities Thinkific can't give you + owning your stack. Decide on
*capability & strategy*, not cost.

### Baseline — Thinkific today
- **~$100–200/mo** (~$1.2–2.4k/yr), **zero build/maintenance** (fully managed).
- Gaps that started this: no gated code Q&A, no Shiki code highlighting, no in-portal reviews on students'
  own repos, no unified portal, limited tiering.

### Build effort (one competent full-stack dev) — incremental
| Phase | Scope | No AI | AI-assisted |
|---|---|---|---|
| 0 · Foundation | Google IdP, D1 schema, Pages Functions, identity, My Courses | 2–3 wk | |
| 1 · Core learning | Lessons (Stream + Markdown/Shiki), course detail, shared Q&A | 3–4 wk | |
| 2 · Reviews | Connect-repo (GitHub App), submissions, inline review UI | 3–4 wk | |
| **— MVP usable (0–2) —** | gated code Q&A + in-portal reviews, alongside Thinkific | **8–11 wk** | **≈ 3–6 wk** |
| 3 · Commerce | Checkout (Stripe one-time **+ subscriptions**), tiers, entitlements, billing | 4–6 wk | |
| 4 · Community + DMs | Forum, DMs, moderation | 2–4 wk | |
| 5 · Admin tooling | Admin, course designer, instructor work queue | 4–6 wk | |
| 6 · Events + coaching | Circle/Miro embeds, rolling backlog, coaching | 2–3 wk | |
| 7 · Public + polish | Landing pages, app-level auth migration, SEO, hardening | 3–5 wk | |
| **Full platform** | all 12 surfaces | **≈ 6–8 months FT solo** | **≈ 3–5 months FT** |

**If contracted out:** MVP ~**€15–35k**; full polished build ~**€55–110k** (≈900–1,400 hrs).

### What AI does / doesn't compress
AI is **big** on boilerplate/CRUD/UI/schema/glue (2–3×), **small** on the parts that set the real timeline:
**payments + tax edge cases** (can't ship money bugs), **auth/security/entitlement gating**, the **GitHub App
+ repo-diff** flow, integration testing, deployment — and **~zero** on *your decisions + product iteration*
(this very design session is the evidence). Coding is only ~40–60% of a real product. So AI turns *MVP* into
weeks, but the *full* build is still **several months** — the long pole is decisions, integration, testing,
and **your available hours**, not typing. Don't vibe-code the money/auth paths; review them.

### Running cost (custom, at your scale — tens–hundreds of students)
- **Cloudflare ~$20–60/mo**, dominated by **Stream** video delivery; D1/Workers/Pages/R2 near-free.
- **Plus what you already pay anyway:** Stripe %, Taxually, **Circle**, **Miro** (all kept). So net monthly
  ≈ comparable to Thinkific — the real delta is the **one-time build + ongoing maintenance**, not infra.

### Verdict & recommended sequencing
- **On cost alone: don't build it** (saving ~$1–2k/yr never repays a €15–110k build).
- **On capability/strategy: worth it** if you'll run this as a product for years and want what Thinkific
  structurally can't do — *and* you accept new responsibilities (you now own auth, payments, security,
  support, uptime).
- **De-risk with MVP-first:** build **phases 0–2 (~3–6 wk AI-assisted)** — gated code Q&A + in-portal reviews
  on your *existing* courses — running **alongside Thinkific** (no big-bang). Ship to real students, see if it
  moves outcomes/retention, *then* commit to the full platform. Turns a 6–8-month bet into a few-week test.
  Migrate Thinkific's jobs last (content/video), since payments are already off it.

## Decision record (the options this supersedes)

The parked analysis weighed three options: **A** stay on GitHub-as-DB, **B** proper DB with GitHub as a
mirror, **C** hybrid (define a storage seam, defer the DB). The leaning was "C now, B later, where the forcing
function is a v2 interactive app." **The v2 app arrived** (this portal), and its requirements (per-course
gating, Google login, auth-scoped views, one unified surface) are precisely what **B** exists for. So: **B,
now** — Cloudflare D1 canonical. GitHub is retained only as an **optional admin kanban** (board #18) and as
the host for **students' own repos** (read-only via a GitHub App, for in-portal reviews) — **not** for PRs.

Buy-it options were considered and rejected for the *primary* surface: **GitHub Discussions** (can't gate per
course, GitHub-only), **Thinkific native** (per-course gating is free but weak code UX, and a separate
destination), **Circle** (good per-course UX + Google login, but still a *separate link to click out to*).
All three fail the "one place, no click-out" requirement. Circle remains a fine option later for *community*
(cohort/social) discussion, distinct from per-course Q&A.

## Open questions

- **Circle scope** — confirm **"all-access scoped to owned courses"** (the leaning) vs per-course support.
- **Review cap** — what's the actual cap on Circle reviews (N/month? N per course?) before it's a higher rung?
- **Q&A notifications** — email on a new question / new submission (so you don't poll the portal)? Cheap.
- **D1 backups / migrations** ops appetite — D1 has point-in-time restore; confirm that's enough.
- **Video host** — confirm Cloudflare Stream (native + signed playback) vs Mux / Vimeo OTT.
- **Circle backlog ownership** — own the rolling event backlog in D1 (leaning) vs leave it in Circle.
- **Thinkific retirement** — order/timeline to absorb video → content (payments already off Thinkific) and cut it off.
- *Resolved:* **Payments = Stripe direct** (Stripe Tax + Taxually; no MoR, not TCommerce). **Reviews =
  in-portal, not PRs** (students' **own repos** via GitHub App). **Q&A = shared per-course board, a Circle
  feature** (not bundled with enrollment). **Community = free/open** (replaces chat). **Live events =
  membership-wide** (Circle stream + Miro), **not per-course**. **Coaching = unlimited 1:1, metered.**
  **Admin/teacher views = build** (work queue + admin + course designer, frames 09–11). **3 roles**
  (student/teacher/admin). **Course = one-time; support = subscription.**

## Relationship to other plans

- Sits on the hosting + Access work from [`20260610-1359-apply-engine-to-real-repo.md`](20260610-1359-apply-engine-to-real-repo.md)
  (Cloudflare Pages + Access are live; this extends them with Functions + D1 + a Google IdP).
- The engine from [`20260610-0927-optivem-school.md`](20260610-0927-optivem-school.md) becomes a **writer into
  D1** (enrollment / submission state) rather than only the board. (Reviews themselves are now done by hand
  in the portal, not engine-driven.)
