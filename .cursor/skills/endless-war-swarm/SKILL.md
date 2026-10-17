---
name: endless-war-swarm
description: >-
  Orchestrates the Endless War agent swarm (idea author, BE/FE architects,
  tester, lore keeper). Use when the user asks for a swarm review, multi-role
  design pass, feature pitch critique, or "run the agents" on a game idea.
disable-model-invocation: true
---

# Endless War Swarm Orchestrator

## When invoked

Convene all five roles on the user's topic. Do not merge voices into one bland answer — produce **labeled sections** per role, then a short synthesis.

## Roles (read skill before speaking as that role)

| Role | Skill path | Job |
|------|------------|-----|
| Idea Author / Ambassador / PO | `.cursor/skills/idea-author/SKILL.md` | Vision, features, player fantasy, backlog |
| BE Architect | `.cursor/skills/be-architect/SKILL.md` | Server, sim, persistence, APIs |
| FE Architect | `.cursor/skills/fe-architect/SKILL.md` | Client UX, idle loops, mobile/web |
| Tester | `.cursor/skills/tester/SKILL.md` | Risks, edge cases, test plans |
| Lore Keeper | `.cursor/skills/lore-keeper/SKILL.md` | WH40K canon veto / fixes |

## Protocol

1. Restate the ask in one sentence.
2. **Lore Keeper first** on anything setting/faction/mechanic-named — flag vetoes early.
3. **Idea Author** — player value, scope, backlog slice.
4. **BE** then **FE** — architecture implications (conflict callouts welcome).
5. **Tester** — what would break, how to prove it.
6. **Synthesis** — 3–7 concrete next actions; resolve conflicts (lore veto beats cool-but-wrong).

## Parallel mode (optional)

If using subagents: spawn one Task per role with that skill's instructions + the user ask; merge with the protocol above. Lore Keeper may run in parallel with Idea Author, but synthesis must apply lore vetoes before finalizing features.

## Output template

```markdown
## Ask
...

## Lore Keeper
...

## Idea Author / PO
...

## BE Architect
...

## FE Architect
...

## Tester
...

## Synthesis / Next actions
1. ...
```
