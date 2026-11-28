# Indic speech frameworks: T-shaped assessment (2026-11-27)

Goal: broad Indian language and accent coverage (top of the T) plus depth of semantic understanding (stem), for a voice assistant running in a browser.

**Scores are Claude's judgement (0-5) from what the pages said, not benchmark results.** Nothing was run or tested.

**None of the seven requested sources gives the full T.**

| Source | What it is | Languages (top) | Accents (top) | Understanding (stem) | Fit | Use |
|---|---|---|---|---|---|---|
| [Sarvam repo](https://github.com/CodeWithSushil/sarvam.ai) | Cloud API examples in an individual's repo | 3 | 1 | 3 | 1 | Optional cloud only; needs a key. MIT |
| [Indic-llm](https://github.com/adithya-s-k/Indic-llm) | LLM training toolkit; Kannada and English | 1 | 0 | 3 | 0 | Skip; not speech. GPL-3.0 code and datasets; models under Llama 2 licensing |
| [Lahaja](https://github.com/ai4bharat/lahaja) | Hindi multi-accent benchmark and NeMo checkpoints | 1 | 4 | 0 | 2 | Test Hindi accents; licence not stated |
| [Indian-Accent-Speech-Recognition](https://github.com/AdroitAnandAI/Indian-Accent-Speech-Recognition) | Indian English on old DeepSpeech | 1 | 2 | 0 | 0 | Skip. CC0 |
| [indicnlp_catalog](https://github.com/AI4Bharat/indicnlp_catalog) | Directory of resources (only partly read word for word) | n/a | n/a | n/a | 2 | Find datasets and text models |
| [IndicWhisper page](https://ai4bharat.iitm.ac.in/areas/model/ASR/IndicWhisper/) | Showed only site navigation | ? | ? | 0 | ? | Not verified |
| [IndicWhisper-JAX](https://github.com/parthiv11/IndicWhisper-JAX) | Individual's TPU/GPU version; Hindi, English, Hinglish | 1 | 2 | 0 | 0 | Skip for browser. MIT |
| [IndicConformer 600M](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual) (extra) | AI4Bharat speech-to-text | 5 | Not shown | 0 | 2 | Main candidate for language coverage |

## What to use

| Need | Choice | Status |
|---|---|---|
| 22 Indian languages | IndicConformer | MIT tag; tagged ONNX |
| English | Separate Whisper model | IndicConformer's list has no English |
| Speech in the browser | sherpa-onnx WebAssembly (as in design) | Not verified with this model |
| Intent | Keyword rules (as the spec requires) | Little semantic depth |
| More semantic depth later | Test MuRIL or IndicBERT for intent classification | Needs its own spec change; safety rules stay fixed |
| Accent testing | Lahaja for Hindi; own recordings for other languages and mixed speech | Check Lahaja's licence |

## Blockers
- **Size and speed:** 600M parameters is likely too large for a basic phone's browser (judgement). No page shows browser or phone latency, so the 3-second target is unproven.
- **Gated download:** IndicConformer needs a Hugging Face login and acceptance of its terms. This could break the no-key Docker setup unless the terms allow including or hosting the model.
- **Accents:** IndicConformer's card reports Hindi WER 13.2 on Vaani-Benchmark-V1.0; no Indian-accent WER. Lahaja reports weaker results for speakers from North-East and South India (no numbers on the page; 132 speakers, 83 districts, 12.5 h).
- **IndicWhisper numbers:** the JAX README reports average Hindi WER 13.6 on Vistaar subsets. Unverified, and not comparable with the 13.2 above.

## Next step
Test whether a compressed IndicConformer runs on the target phone. If not, bring server-side speech recognition back to spec review (audio would leave the phone; offline and privacy requirements would change).

## Not checked
- Indic-Transcribe (`bodhan-ai/indic-transcribe-core`), which the IndicConformer card recommends; listed as supporting 25 Indian languages.
- sherpa-onnx browser support, and the MuRIL and IndicBERT model pages.
- IndicConformer's actual file list.
