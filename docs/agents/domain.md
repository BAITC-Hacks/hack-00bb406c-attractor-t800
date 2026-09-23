# Domain Docs

This repository uses a single domain context: `CONTEXT.md` at the repository root and `docs/adr/` for architecture decision records.

## Before exploring, read these

- Read root `CONTEXT.md` for domain vocabulary.
- Read ADRs in `docs/adr/` that touch the area you are about to work in.

If these files do not exist, proceed silently. Do not suggest creating empty documents. The `domain-modeling` skill creates them lazily when terms or decisions are resolved.

## File structure

- `CONTEXT.md`: the domain glossary; no implementation details.
- `docs/adr/`: architecture decision records, created when a meaningful trade-off needs a durable explanation.

## Use the glossary's vocabulary

Use terms as defined in `CONTEXT.md` in issue titles, proposals, hypotheses, and tests. Do not drift to synonyms the glossary avoids. If a needed concept is missing, reconsider the term or note the gap for `domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, surface the conflict explicitly and explain why reopening the decision may be justified. Do not silently override it.
