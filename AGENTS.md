# Codex project guidance

## Source of truth

- Git and GitHub are the source of truth. Never rely on files or installed packages that exist only in one cloud task.
- Keep changes scoped, commit them on the current branch, and include the commands and results used for verification.
- Never commit credentials or `.env` files.

## Setup and verification

- Use Node.js 20 as selected by `.nvmrc`.
- Run `bash scripts/codex-setup.sh` when a fresh Codex environment is created.
- Run `npm test` and `npm run build` before completing code changes.
- For user-visible web changes, start the application and check it in a browser. Capture a screenshot when the environment provides browser tooling.

## Implementation conventions

- Keep game rules independent from Phaser, React, and Socket.IO where practical so they can be unit tested.
- Add or update tests for behavior changes.
- Update README or relevant files under `docs/` when commands, architecture, or user-visible behavior changes.
- User-facing project documentation and review summaries should be written in Japanese. Code identifiers and source comments may be in English.
