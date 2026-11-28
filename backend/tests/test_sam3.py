"""The SAM 3 pocket detector, tested on real SAM 3 replies saved on 2026-11-28 for eight hand-counted public
photos (openspec/changes/label-image-processing/design.md, decision 20). No live calls are made."""
import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)
FIXTURES = Path(__file__).parent / "fixtures" / "sam3"
KEYS = ["ROBOFLOW_PRIVATE_API_KEY", "ROBOFLOW_MODEL_ID", "ROBOFLOW_CLASS_MAP", "POCKET_DETECTOR"]


def reply(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text())


def strips_of(saved: dict) -> list:
    return next(r for r in saved["prompt_results"] if r["echo"]["text"] == "blister pack")["predictions"]


def only_strip(saved: dict, index: int) -> dict:
    """The same photo as if only one of its strips were in view: the other outlines are taken away."""
    one = copy.deepcopy(saved)
    kept = strips_of(one)
    kept[:] = [sorted(kept, key=lambda s: min(p[1] for polygon in s["masks"] for p in polygon))[index]]
    return one


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    for name in KEYS:
        monkeypatch.delenv(name, raising=False)
    main.cloud_calls.clear()


# ---------- one strip in view ----------
@pytest.mark.parametrize("name, full", [
    ("C1-ubenimex", 2),   # 13 used pockets scored 0.55-0.68; 2 capsules printed on the box are off the strip
    ("C2-tramadol", 6),   # 3 loose capsules lie beside the strip
    ("C3-tamiflu", 10),
])
def test_pills_on_the_strip_are_counted_and_nothing_else(name, full):
    result = main.sam3_result(reply(name))
    assert result["strips"] == 1 and result["strip"] is not None
    assert (len(result["full"]), result["empty"]) == (full, [])
    strip = result["strip"]
    for pill in result["full"]:
        centre = (pill["x"] + pill["w"] / 2, pill["y"] + pill["h"] / 2)
        assert strip["x"] <= centre[0] <= strip["x"] + strip["w"] and strip["y"] <= centre[1] <= strip["y"] + strip["h"]


def test_picture_on_the_box_is_not_counted():
    saved = reply("C1-ubenimex")
    pills = next(r for r in saved["prompt_results"] if r["echo"]["text"] == "pill")["predictions"]
    assert sum(p["confidence"] >= 0.9 for p in pills) == 2, "the two capsules printed on the box score highest of all"
    assert len(main.sam3_result(saved)["full"]) == 2, "and are still left out, because they are not on the strip"


def test_used_pockets_below_the_bar_are_dropped():
    saved = reply("C1-ubenimex")
    pills = next(r for r in saved["prompt_results"] if r["echo"]["text"] == "pill")["predictions"]
    assert len(pills) == 19 and main.SAM3_BAR == 0.7
    for pill in pills:  # with the bar taken away, all 15 pockets of the strip would count
        pill["confidence"] = max(pill["confidence"], 0.99)
    assert len(main.sam3_result(saved)["full"]) == 15


# ---------- more than one strip, or none ----------
@pytest.mark.parametrize("name, strips", [("C4-zumenon", 2), ("C5-strattera", 2), ("C6-three-strips", 3), ("C7-diazepam", 2), ("C8-anterone", 3)])
def test_more_than_one_strip_gives_no_strip_and_no_pockets(name, strips):
    assert main.sam3_result(reply(name)) == {"strip": None, "full": [], "empty": [], "strips": strips}


def test_no_strip_or_an_empty_reply_gives_nothing():
    saved = reply("C3-tamiflu")
    strips_of(saved).clear()
    nothing = {"strip": None, "full": [], "empty": [], "strips": 0}
    assert main.sam3_result(saved) == nothing, "pills with no strip outline are not counted"
    assert main.sam3_result({}) == nothing and main.sam3_result({"prompt_results": []}) == nothing


# ---------- each strip of the busy photos, as if shown alone (the counts in decision 20) ----------
@pytest.mark.parametrize("name, index, full", [
    ("C4-zumenon", 0, 25),      # 3 used pockets scored 0.56-0.65
    ("C4-zumenon", 1, 28),
    ("C5-strattera", 0, 0),     # a printed foil back (the two strips lie side by side; sorted by their top edge)
    ("C5-strattera", 1, 14),
    ("C7-diazepam", 0, 0),      # a printed foil back
    ("C8-anterone", 0, 10),
    ("C8-anterone", 1, 0),      # a printed foil back: 6 false marks at 0.50-0.67 dropped
    ("C8-anterone", 2, 10),
    ("C6-three-strips", 0, 0),  # foil domes hide the pills
    ("C6-three-strips", 2, 0),  # 10 flat red tablets: SAM 3 finds none (a miss, never a wrong number)
])
def test_each_strip_alone(name, index, full):
    result = main.sam3_result(only_strip(reply(name), index))
    assert result["strips"] == 1 and len(result["full"]) == full


@pytest.mark.xfail(strict=True, reason="Known limit (design decision 18): SAM 3 scores the 5 torn-open pockets 0.82-0.88, as high as "
                                       "the 5 real tablets, and says 10. It needs a second opinion before it may be the default.")
def test_known_limit_torn_open_pockets():
    assert len(main.sam3_result(only_strip(reply("C7-diazepam"), 1))["full"]) == 5


# ---------- geometry ----------
def test_inside_follows_the_outline_not_its_box():
    triangle = [[0, 0], [100, 0], [0, 100]]
    assert main.inside((10, 10), triangle) and not main.inside((90, 90), triangle), "(90, 90) is in the box but outside the triangle"
    assert main.box_of([triangle, [[200, 50], [220, 50], [220, 80]]]) == {"x": 0, "y": 0, "w": 220, "h": 100}


def test_a_pill_in_the_box_but_outside_the_outline_is_left_out():
    strip = {"masks": [[[0, 0], [100, 0], [0, 100]]], "confidence": 0.9}
    pill = lambda x, y: {"masks": [[[x - 5, y - 5], [x + 5, y - 5], [x + 5, y + 5], [x - 5, y + 5]]], "confidence": 0.9}
    saved = {"prompt_results": [{"echo": {"text": "pill"}, "predictions": [pill(20, 20), pill(85, 85)]},
                                {"echo": {"text": "blister pack"}, "predictions": [strip]}]}
    assert len(main.sam3_result(saved)["full"]) == 1


def test_words_are_matched_by_position_when_the_reply_does_not_echo_them():
    saved = reply("C3-tamiflu")
    kept = [r for r in saved["prompt_results"] if r["echo"]["text"] in main.SAM3_WORDS]
    for index, result in enumerate(kept):
        result.pop("echo")
        result["prompt_index"] = index
    assert len(main.sam3_result({"prompt_results": kept})["full"]) == 10


# ---------- the adapter behind the switch ----------
def sam3_with(monkeypatch, saved):
    monkeypatch.setenv("ROBOFLOW_PRIVATE_API_KEY", "k")
    asked = []

    def segment(image):
        asked.append(image)
        if isinstance(saved, Exception):
            raise saved
        return saved

    monkeypatch.setattr(main, "sam3_segment", segment)
    return asked


def test_chosen_sam3_answers_the_count_request(monkeypatch):
    asked = sam3_with(monkeypatch, reply("C2-tramadol"))
    monkeypatch.setenv("POCKET_DETECTOR", "sam3")
    assert client.get("/api/status").json()["visionFallback"] is True, "it needs the Roboflow key only, no trained model"
    found = client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json()
    assert asked == ["aGk="] and (len(found["full"]), found["strips"]) == (6, 1)


def test_chosen_not_the_default(monkeypatch):
    asked = sam3_with(monkeypatch, reply("C2-tramadol"))
    monkeypatch.setenv("ROBOFLOW_MODEL_ID", "a/1")
    monkeypatch.setattr(main, "infer_strip", lambda image, model_id: {"predictions": []})
    client.post("/api/vision/fallback", json={"imageJpeg": "aGk="})
    assert asked == [], "with POCKET_DETECTOR not set, SAM 3 is never called"


def test_sam3_without_the_key_or_failing(monkeypatch):
    monkeypatch.setenv("POCKET_DETECTOR", "sam3")
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"error": "key_not_set"}
    assert client.get("/api/status").json()["visionFallback"] is False
    sam3_with(monkeypatch, RuntimeError("down"))
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"error": "unavailable"}


def test_every_detector_keeps_the_adapter_shape():
    assert set(main.POCKET_DETECTORS) == {"roboflow", "sam3"}
    assert all(isinstance(engine, main.Engine) for engine in main.POCKET_DETECTORS.values())
