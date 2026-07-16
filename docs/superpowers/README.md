# Historical Workflow Artifacts

Files under `plans/` and `specs/` record completed issue work. They are retained
only for historical context and are not implementation instructions or sources
of truth.

For current work, use:

1. `AGENTS.md` for engineering and delivery rules.
2. `docs/cogvest-master-spec.md` for product behavior.
3. The active GitHub issue for acceptance criteria.
4. `DESIGN.md` and `docs/design/v1-screen-baseline.md` only for UI work.
5. Current testing/release documents when those boundaries are affected.

Do not add a durable spec or plan here for routine changes. Critical financial,
persistence, security, migration, or architecture changes may keep a concise
approved contract when it has value beyond the merged PR.
