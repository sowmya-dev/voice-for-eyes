# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. language-support

- [ ] 1.1 [Requirement: Supported languages] Build the language registry for the 23 languages and record coverage and any gap. Verify: "Code-mixed question".
- [x] 1.2 [Requirement: Language detection and switching] Implement confident-only switching until a language is named, with tests. Verify: "Confident detection", "Uncertain detection", "Language already named".
- [x] 1.3 [Requirement: Explicit language change] Switch language when a language name is spoken and set speech recognition to it, with tests. Verify: "Language named", "Recognition follows", "Named while auto-detecting".
- [x] 1.4 [Requirement: Reply language] Implement reply-language selection. Verify: "Mixed speech", "No voice input".
- [ ] 1.5 [Requirement: Language drives processing] Select recognition model, templates and voice from the session language. Verify: "Kannada utterance".
