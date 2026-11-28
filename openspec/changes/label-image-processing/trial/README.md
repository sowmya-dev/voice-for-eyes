# Trial evidence: finding pills by name

Evidence for `design.md`, decision 20. Nothing here is used by the app.

## sam3/

One raw reply from SAM 3 concept segmentation on Roboflow (`/sam3/concept_segment`, model `sam3/sam3_final`, threshold 0.5, polygon masks) for each of the photos C1-C8, taken on 2026-11-28. The photo behind each file, its licence and its hand count are in the table of decision 20.

Each file's `prompt_results` are in this order, and each carries its own word in `echo.text`:

| Index | Word |
|---|---|
| 0 | pill |
| 1 | capsule |
| 2 | tablet |
| 3 | blister pack |

A prediction is `{ masks, confidence, format }`, where `masks` holds the outline as `[x, y]` points in pixels of the 1280 px wide photo.

The rule measured in decision 20 is: count the `pill` predictions with confidence 0.7 or more whose centre lies inside a `blister pack` outline.

These are kept so that the Molmo run can test "points inside the outline" against the same outlines without calling SAM 3 again. The photos P1-P4 have no saved reply: only their counts and confidences were recorded.

The photos themselves are not stored here. C1-C8 can be fetched again from Wikimedia Commons by the file titles in decision 20, at 1280 px wide.
