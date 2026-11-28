# Saved SAM 3 replies

Real replies used by `backend/tests/test_sam3.py`, and the evidence for decisions 18 and 20 in `openspec/changes/label-image-processing/design.md`. The app does not read them.

One raw reply from SAM 3 concept segmentation on Roboflow (`/sam3/concept_segment`, model `sam3/sam3_final`, threshold 0.5, polygon masks) for each of the photos C1-C8, taken on 2026-11-28. The photo behind each file, its licence and its hand count are in the table of decision 20.

Each file's `prompt_results` are in this order, and each carries its own word in `echo.text`:

| Index | Word |
|---|---|
| 0 | pill |
| 1 | capsule |
| 2 | tablet |
| 3 | blister pack |

The app asks for `pill` and `blister pack` only. `capsule` and `tablet` were part of the trial; the detector ignores them.

A prediction is `{ masks, confidence, format }`, where `masks` holds the outline as `[x, y]` points in pixels of the 1280 px wide photo.

The rule built from them: count the `pill` predictions with confidence 0.7 or more whose centre lies inside the one `blister pack` outline.

They are also kept so that the Molmo run can test "points inside the outline" against the same outlines without calling SAM 3 again. The photos P1-P4 have no saved reply: only their counts and confidences were recorded.

The photos themselves are not stored here. C1-C8 can be fetched again from Wikimedia Commons by the file titles in decision 20, at 1280 px wide.
