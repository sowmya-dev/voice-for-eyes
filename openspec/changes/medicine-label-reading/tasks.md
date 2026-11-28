# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. medicine-label-reading

- [x] 1.1 [Requirement: Identify medicine] Build the danger-first identification answer. Verify: "What is this tablet".
- [x] 1.2 [Requirement: Purpose from bundled table] Create the ingredient table and lookup. Verify: "Purpose stated", "Ingredient not listed".
- [ ] 1.3 [Requirement: Printed information only] Answer counts only from accepted printed text. Verify: "Visible tablets counted", "Count question", "Count not available".
- [ ] 1.4 [Requirement: Food labels and follow-ups] Add food label, nutrition and follow-up answers. Verify: "Nutrition follow-up".
- [x] 1.5 [Requirement: Spoken templates and voice] Add per-language templates, speak them through Sarvam on the app server with the on-device fallback, with tests. Verify: "Spoken reply", "Sarvam unavailable", "No online browser voice while cloud help is off", "No voice at all", "Speech key stays on the server", "Stopped by the user", "Name spoken as a word", "Strength in Kannada", "No wait between parts".
- [x] 1.6 [Requirement: Admit what is unreadable] State which requested information cannot be read. Verify: "Partly readable".
- [ ] 1.7 [Requirement: Two strips in view] Handle two strips and keep their details separate, with tests. Verify: "Two readable strips", "One name unreadable".
- [x] 1.8 [Requirement: Conversational replies] Say identification as a sentence, say once that reading continues, and offer one unasked detail answered from memory, the count only when it is already known, with tests. Verify: "Identified as a sentence", "Still reading", "Offer what is left", "Offer accepted", "Nothing left to offer", "Count offered only when known", "Count not offered after it failed", "No offer after a warning".
- [x] 1.9 [Requirement: Count from the printed total] Parse pack sizes, combine the printed total with agreed empty pockets, ask for the printed side when needed, with tests and a run on the model's held-out images. Verify: "Worked out from the print", "Printed total not read yet", "Pack size written as 1 x 10", "More empty than printed".
- [x] 1.10 [Requirement: Everything printed, by size] Keep agreed lines with their letter size in tiers, merge them across reads, and read them back largest first, 8 at a time, without dosage lines, with tests. Verify: "Ranked by size", "Kept across reads", "Read everything", "More text", "Dosage left out", "Expired label read out".
- [x] 1.11 [Requirement: Composition and description] Extract composition, generic name and maker, answer composition and description questions from memory, with tests. Verify: "Composition printed", "Chemical name", "Composition not readable", "Tell me about it", "Expired description".
