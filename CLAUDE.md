# Voice for Eyes

Spec-first development with OpenSpec. No feature code until the change's spec and design are reviewed and agreed.

- The ground rules (G1-G8) are in [`openspec/config.yaml`](openspec/config.yaml). Follow all of them.
- The source prompt is `problem-statement.md`. Do not edit it. The map from the prompt to the specs is `openspec/traceability.md`.
- Build order: `core-flow-mvp` comes first.
- Checks: `node openspec/check-rules.js` and `openspec validate --all --strict`.

## Write lock (G4)

When more than one agent or subagent is running, only one may write at a time. This covers every file change, including edits made through shell commands.

1. Before the first write, take the lock: `mkdir .agent-write.lock`. If the command fails, another agent holds it. Do not write; wait or report back.
2. Record the holder: write your agent name to `.agent-write.lock/owner`.
3. Hold the lock until your whole unit of work is finished and checked, not just one edit.
4. Release it: `rm -r .agent-write.lock`. Release only a lock you own.
5. If a lock looks abandoned, ask the user before removing it.

Subagents are read-only by default. An orchestrating agent that delegates writing must not write until that subagent has released the lock.

This lock relies on agents following these instructions. No tool blocks a write without it.
