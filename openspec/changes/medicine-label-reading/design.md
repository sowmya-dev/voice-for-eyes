# Design: medicine-label-reading

## Context
Turns a trusted LabelReading and an Intent into a spoken answer. Depends on label-image-processing, safety-rules and language-support. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Templates, never free text
- **Status:** Proposed
- **Plain English:** Every sentence comes from a prepared template filled with accepted values.
- **Pseudo-technical:** `plan = [segment(templateId, slots)]; a segment is dropped or replaced by "cannot read" when a slot is null`

### 2. Fixed danger-first order
- **Status:** Proposed
- **Plain English:** Warnings come first, then name, purpose, expiry and quantity.
- **Pseudo-technical:** `order = [warning?, name, purpose?, expiry, quantity?]; the rule engine may prepend or remove segments`

### 3. Purpose is a table lookup
- **Status:** Proposed
- **Plain English:** The app states what a medicine is for only if its ingredient is in the bundled table.
- **Pseudo-technical:** `purpose = table[normalise(ingredient)] or null`

## High-level architecture flow
```text
Intent + LabelReading -> AnswerBuilder -> draft ResponsePlan -> rule engine -> TemplateRenderer -> Speaker
                                   ^
                             ingredient table
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| AnswerBuilder | chooses segments for the intent | reads LabelReading and IngredientTable |
| IngredientTable | bundled static data | returns a purpose key or null |
| TemplateRenderer | fills per-language templates | uses SessionLanguage |
| Speaker | browser speech synthesis with fade-out | stopped by the interruption handler |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
IngredientEntry = { ingredient: string, purposeKey: string }
Segment         = { templateId: string, slots: Record<string,string> }
ResponsePlan    = { intent: Intent.name, labelId: string|null, lang: BCP47, segments: Segment[], containsDosage: bool }
Template        = { templateId: string, lang: BCP47, text: string }
```

## Tool schemas
```text
ingredients.lookup(ingredient) -> purposeKey|null
compose.build(Intent, LabelReading) -> ResponsePlan
compose.render(ResponsePlan) -> string
speech.speak(string, lang) -> events: start | end | cancelled
```

## Agent flow
intent -> build draft plan -> safety rules return the allowed plan -> render in the session language -> speak.

## Open decisions
- R2: whether the camera may count visible tablets. Recommendation: allow it only for the count question, never for dosage.
- R4: behaviour of the safety intent. Recommendation: read matching printed warnings only and never say "safe".
- R7: what happens when a language has no voice. Recommendation: say so in a language the user knows.
- R9: month-only expiry dates and rounding of "in three months".

## Risks
- A device may lack a voice for the language. Mitigation: detect it and tell the user.
- Food and nutrition layouts differ widely. Mitigation: state only what is readable.
