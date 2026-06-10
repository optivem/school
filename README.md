# Optivem School

An open-source, **GitHub-backed learning platform** for guided practice: students submit sandbox
projects and ask questions, teachers review and mark progress — all scoped by course enrollment.

> **Status:** early / work in progress. v1 is being built.

## What it is

Optivem School turns a GitHub repo into a structured learning platform with three roles:

| Role | Can do |
|---|---|
| **Student** | Ask questions · submit a **project review request** · track **their progress** — scoped to enrolled courses |
| **Teacher** (reviewer) | Answer questions · **review** submissions · move **status → completed** |
| **Administrator** | Manage the roster, courses, projects, and enrollment |

The signature loop is **submit → review → complete**, tracked per student. It is a structured learning
platform (guided practice with expert review), not a casual community.

## How it works (GitHub-native)

It's **config-driven** and built on primitives GitHub already provides — no bespoke backend:

- **Config** (`config/*.json`) — students, teachers/reviewers, projects, courses, board.
- **Submissions = GitHub Issues** via generated per-course issue templates.
- **Status = a GitHub Projects v2 board** (Open · In Progress · In Review · Done).
- **Automation = GitHub Actions** — validate submissions, dedupe, add to the board, transition status.
- **Read surface = a generated static dashboard** (a courses × projects progress matrix).

This mirrors the model proven in Optivem's own learning hub.

## The two configurable lists

Each deployment owns **who** participates — these are plain config you edit:

- **`config/students.json`** — the student roster (`github` handle + `name`).
- **`config/reviewers.json`** — the teacher/reviewer list (can review any project).

See [`config/README.md`](config/README.md) for the full schema and the other config files
(`projects.json`, `courses/*.json`, `board.json`).

## Deploy your own (no fork required)

Optivem School is a **GitHub template repo** — click **“Use this template”** to get your own
independent repo (not a fork), then:

1. **Edit config** — copy each `config/*.example.json` → `config/*.json` and fill in your roster,
   projects, courses. Validate with `npm run config:check`.
2. **Create a GitHub Projects v2 board** and record its IDs in `config/board.json`.
3. **Enable GitHub Actions** in your repo (the workflows automate submissions + status).
4. **Host the dashboard** — see below.

## Hosting

The dashboard shows **private student data**, so it must be **gated** — and on the GitHub Free plan,
Pages won't serve a private repo. So:

- **Cloudflare Pages** serves the generated static dashboard (works from a private repo, free).
- **Cloudflare Access** (free Zero Trust) gates it to an allow-list by email / GitHub — no custom auth.
- Point a subdomain at it with a single CNAME at your DNS provider.

## Development

```sh
npm run config:check    # validate config/*.json and print a summary
```

Requires Node ≥ 20. No build step.

## License

[AGPL-3.0-or-later](LICENSE). Contributions require agreeing to the [CLA](CLA.md) — see
[CONTRIBUTING.md](CONTRIBUTING.md).
