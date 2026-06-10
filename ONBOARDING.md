# Onboarding a new Optivem School

How to stand up your own school. **Every step is idempotent** — safe to re-run; it creates what's
missing and reconciles what's drifted, rather than duplicating.

> Steps marked **(engine in progress)** are not fully automated yet — they're documented so the flow
> is clear, and will become `npm run` steps as the engine lands.

## 1. Create your repo from the template

On `github.com/optivem/school`, click **“Use this template” → Create a new repository**. This gives you
an independent repo (not a fork). Clone it locally. Requires **Node ≥ 20**.

## 2. Scaffold your config

```sh
npm run init
```

Copies `config/*.example.json` → `config/*.json` (skips any that already exist). Then **edit** them for
your school:

- `config/students.json` — your student roster (`github` + `name`).
- `config/reviewers.json` — your teacher/reviewer list.
- `config/projects.json` — sandbox projects + their members.
- `config/courses/*.json` — your courses and modules.

Validate any time:

```sh
npm run config:check
```

## 3. Create the GitHub Projects v2 board  (engine in progress)

The board tracks submissions and their status. Onboarding will **reconcile** it:

- If `config/board.json` has no real board id → create the board (`gh project create`), then write its
  id/number/url back into `config/board.json`.
- Reconcile the custom fields (**Course**, **Sandbox Project**, **Module**) and the **Status** options
  (Open / In Progress / In Review / Done) against your config — create missing, leave existing.

Re-running never duplicates a board or a field; it only fills gaps.

## 4. Generate derived files

```sh
npm run sync
```

Regenerates everything that's derived from config (deterministic, so inherently idempotent):

- `.github/ISSUE_TEMPLATE/<course>-sandbox-review.yml` — the “Submit a review request” forms.
- (more as the engine grows: review checklists, the dashboard.)

Commit the generated files.

## 5. Enable GitHub Actions

In your repo: **Settings → Actions → General → Allow all actions**. The workflows automate
submissions: validate → dedupe → add to board → set fields → transition status.

## 6. Host the dashboard  (engine in progress)

The dashboard shows private student data, so it must be gated:

- **Cloudflare Pages** — connect your (private) repo; build output is the generated dashboard.
- **Cloudflare Access** — add an allow-list policy (email / GitHub) so only your members can view it.
- Point a subdomain at it (one CNAME at your DNS provider → the `*.pages.dev` host).

## Re-running onboarding

Run any step again at will: `npm run init` skips existing config, board setup reconciles, and
`npm run sync` regenerates from config. Setup is **declarative** — config is the source of truth.
