# Configuration

Optivem School is **config-driven** (mirrors `optivem/hub`). To stand up a deployment, **copy each
`*.example.json` to the same name without `.example`** and edit it for your school. The template ships
only the `*.example.json`; your deployment commits the real `*.json`.

```
config/students.example.json   →  config/students.json
config/reviewers.example.json  →  config/reviewers.json
config/projects.example.json   →  config/projects.json
config/board.example.json      →  config/board.json
config/courses/01-example.example.json → config/courses/01-<your-course>.json
```

Validate with: `npm run config:check` (or `node scripts/load-config.mjs`).

## The two configurable lists

These are the lists each deployment owns — they decide **who** can do what:

### `students.json` — the student roster
```json
[{ "github": "octocat", "name": "Octo Cat" }]
```
A `github` handle + display `name` per student. (For Optivem, this is synced from Thinkific — manually
for now, automatically later.) Per-project access is governed by `projects.json` → `members`; this
roster is the master name/handle map.

### `reviewers.json` — the teacher/reviewer list
```json
[{ "github": "valentinajemuovic", "name": "Valentina Jemuovic" }]
```
Teachers/coaches. A reviewer can review **any** project, comment on issues, and drive status
transitions. Keep this list small and trusted.

## The other config

### `projects.json` — sandbox projects students submit for review
```json
[{
  "key": "DEMO",
  "name": "Demo Sandbox Project",
  "repo": "https://github.com/your-org/demo-sandbox",
  "lead": "octocat",
  "members": ["octocat", "hubot"]
}]
```
`key` = a short uppercase acronym. `members` = the students who may submit review requests for this
project (access control). `lead` = the primary member.

### `courses/*.json` — a course = an LMS link + ordered modules
```json
{
  "id": "example",
  "name": "Example Course",
  "courseSlug": "example",
  "url": "https://your-lms.example.com/courses/example",
  "modules": [
    { "number": "01", "label": "01-introduction", "name": "Introduction", "url": "" }
  ],
  "projectKeys": ["DEMO"]
}
```
`number` = 2-digit module number; `label` = the module's directory slug; `url` = the LMS student-view
link; `projectKeys` = which projects apply to this course.

### `board.json` — the GitHub Projects v2 board that tracks submissions
```json
{
  "title": "Your School",
  "board": { "id": "PVT_…", "number": 0, "url": "…", "statusFieldId": "PVTSSF_…", "statusOptionIds": { "IN_PROGRESS": "…", "IN_REVIEW": "…", "DONE": "…" }, "courses": ["example"] },
  "statuses": [{ "key": "OPEN", "name": "Open" }, { "key": "IN_PROGRESS", "name": "In Progress" }, { "key": "IN_REVIEW", "name": "In Review" }, { "key": "DONE", "name": "Done" }]
}
```
The `id` / `statusFieldId` / `statusOptionIds` are real GitHub Projects v2 node IDs you fill in after
creating your board (a helper to fetch them comes with the project-sync script).

## Naming conventions (kept identical to hub)

- **Project key:** 4-letter uppercase acronym (e.g. `DEMO`, `CCRS`).
- **Module number:** 2-digit zero-padded (`01`, `02`, … `15`).
- **Course id:** short lowercase (`pipeline`, `atdd`).
- **Sandbox Project option name:** `KEY — Name` · **Module option name:** `NN - Name`.
- **Issue title (auto-set):** `KEY — Module Name`.
