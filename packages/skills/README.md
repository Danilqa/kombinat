# Skills

The Kombinat plugin for Claude Code. Its skills teach Claude how to work with Kombinat.

| Skill                 | What it does                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `write-routines`      | Writes and edits routines: picks the approach and the settings, writes the prompt, validates   |
| `debug-runs`          | Finds out why a run failed, was blocked or never started, and suggests the fix                 |
| `review-routines`     | Reviews routines for wasted tokens, risky permissions, weak prompts and schedules that collide |
| `write-webhook-gates` | Writes the gate of a webhook routine: signature check, event filter and conversations          |
| `migrate-to-routines` | Moves cron jobs and scheduled GitHub Actions workflows to routines                             |

## Install

In Claude Code:

```
/plugin marketplace add Danilqa/kombinat
/plugin install kombinat@kombinat
```

Then ask for what you need, such as a new routine, or type a skill's name, such as `/kombinat:write-routines`.

## Develop

Run them from the repo root.

```bash
claude --plugin-dir packages/skills      # try the plugin from this checkout
claude plugin validate packages/skills   # check the plugin and its skills
claude plugin validate .                 # check the marketplace file
```

A skill is a folder in `skills/` with a `SKILL.md`. The marketplace file in `.claude-plugin/` at the repo root points Claude Code to this folder.
