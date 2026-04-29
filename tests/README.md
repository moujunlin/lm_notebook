# Notebook TDD Tests

Run all contract tests:

```powershell
node --test --test-isolation=none tests/contract/*.test.mjs tests/integration/*.test.mjs
```

These tests are intentionally red before implementation. Kimi should implement the files and behavior described by `notebook.design.v3.md` until the suite is green.

Optional live API tests run only when both environment variables are present:

```powershell
$env:NOTEBOOK_API_URL = "https://xxx.supabase.co/functions/v1/notebook-api"
$env:NOTEBOOK_API_TOKEN = "your-token"
node --test --test-isolation=none tests/integration/*.test.mjs
```

The implementation is expected to provide:

- `index.html`
- `supabase/setup.sql`
- `supabase/edge-function.ts`
- `CLAUDE_INSTRUCTIONS.md`

## v1.1 Coverage

`tests/contract/frontend-v1.1.contract.test.mjs` maps to `notebook-v1.1-impl.md`.

Because Kimi had already implemented part of v1.1 before these tests were added, this suite is not expected to be all red. The following test groups may already be green and should be treated as "implemented before test landed", not as missing TDD work:

- P0 local state updates after write operations
- P0 annotation submit remains expanded
- P1 date filters and persisted `notebook.dateFilter`
- P1 header refresh placement and `edit-actions`
- P2 Chinese UI copy and settings display names

Any remaining red tests are the backlog for Kimi to implement. Codex owns these tests; Kimi should not edit them directly.

## v1.2 Coverage

`tests/contract/frontend-v1.2.contract.test.mjs` and `tests/contract/edge-function-v1.2.contract.test.mjs` map to `notebook-v1.2-impl.md`.

These v1.2 tests are intended to be red before implementation. They cover:

- mobile touch target and input zoom CSS
- markdown export via `GET /entries?include=annotations`
- project-URL connection flow and optional token auth
- local entry-content search
- annotation author colors
- bilingual UI with persisted `notebook.lang`
- static first-paint boot placeholder

Run only the new v1.2 suite:

```powershell
node --test --test-isolation=none tests/contract/*v1.2*.test.mjs
```
