# Contributing to Optivem School

Thanks for your interest in contributing.

## Contributor License Agreement (CLA)

By submitting a contribution (pull request, patch, or otherwise) you agree to the terms in
[CLA.md](CLA.md). In short: you license your contribution to the project under
**AGPL-3.0-or-later**, and you grant Optivem the right to also license the combined work under other
terms (e.g. a future commercial/dual license). You retain copyright to your contribution.

## Development setup

- **Node ≥ 20**, no build step.
- Validate config: `npm run config:check`.

## Conventions

- Keep changes small and focused; match the surrounding code style.
- Don't commit a deployment's real `config/*.json` to this **template** repo — only the
  `*.example.json` belong here.
- Preserve the naming conventions documented in [`config/README.md`](config/README.md)
  (project keys, module numbers, course ids, board option names).

## Reporting issues

Open a GitHub issue describing the problem, expected vs actual behaviour, and steps to reproduce.
