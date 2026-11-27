# Design: surroundings-description

## Context
Handles the `scene` intent. Depends on cloud-assistance for any online answer. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. No local scene model
- **Status:** Proposed
- **Plain English:** Without the cloud the app says it cannot describe surroundings.
- **Pseudo-technical:** `if cloud.state != "ready": say OFFLINE_LINE`

### 2. Follow-ups use a fresh frame
- **Status:** Proposed
- **Plain English:** A follow-up looks at what the camera sees now, with the recent scene questions for context.
- **Pseudo-technical:** `request = { image: currentFrame, question, history: last N scene turns }`

## High-level architecture flow
```text
intent scene -> cloud ready? --no--> offline line
                      | yes
                      +-> current frame + question + history -> cloud -> rule engine -> speech
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| SceneHandler | checks cloud state and builds the request | calls the cloud client |
| SceneHistory | recent scene questions and answers in memory | cleared with session memory |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
SceneRequest = { imageJpeg: bytes, question: string, lang: BCP47, history: {question, answer}[] }
SceneResult  = { text: string } | { error: 'unavailable' }
```

## Tool schemas
```text
cloud.run({ task: 'scene', ...SceneRequest }) -> SceneResult
```

## Agent flow
scene intent -> check cloud -> send frame -> speak the result through the pipeline, or speak the offline line.

## Open decisions
- How a follow-up is told apart from a new medicine question. Recommendation: scene keywords keep it in the scene intent.
- History length N. Recommendation: 3 turns.

## Risks
- A scene image leaves the device and may show people. Mitigation: only after the user enables cloud.
- A wrong description could mislead movement. Mitigation: raise safety wording in review.
