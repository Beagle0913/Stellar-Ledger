## Summary

<!-- What changed and why -->

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for layer rules and extension checklists.

## Persistence checklist

If this PR adds or changes **mutable campaign state** (not just read-only views or JSON content), confirm:

- [ ] `GameState` / shared types updated in [`src/shared/types/state.ts`](../src/shared/types/state.ts)
- [ ] SQLite migration added in [`src/database/migrations.ts`](../src/database/migrations.ts) and schema version bumped
- [ ] Repository read/write updated (see [`docs/PERSISTENCE.md`](../docs/PERSISTENCE.md))
- [ ] [`saveManager.ts`](../src/database/saveManager.ts) assembles the new fields on load/create
- [ ] Migration test added or extended ([`tests/migrations.test.ts`](../tests/migrations.test.ts))
- [ ] Ran `node scripts/scaffold-state-field.mjs verify` if applicable

## IPC checklist

If this PR adds a **new GameApi method**:

- [ ] Entry added to [`src/shared/ipcMethods.ts`](../src/shared/ipcMethods.ts)
- [ ] `GameApi` updated in [`src/shared/types/api.ts`](../src/shared/types/api.ts)
- [ ] Handler in [`src/main/dispatch.ts`](../src/main/dispatch.ts) and service module
- [ ] Zod schema in [`src/main/ipcSchemas.ts`](../src/main/ipcSchemas.ts) when payload required
- [ ] [`tests/ipc.test.ts`](../tests/ipc.test.ts) `payloadFor()` extended
- [ ] Ran `node scripts/scaffold-ipc.mjs verify`

## Test plan

- [ ] `pnpm verify` (or `npm run verify`)
