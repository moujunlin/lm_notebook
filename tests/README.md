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
