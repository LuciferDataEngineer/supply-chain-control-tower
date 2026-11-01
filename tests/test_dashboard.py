"""The published dashboard has to match the warehouse, and the page must not bake in numbers."""

import json
import os
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "site" / "data" / "dashboard.json"
HTML = ROOT / "site" / "index.html"
WAREHOUSE = os.environ.get("WAREHOUSE_PATH", str(ROOT / "data" / "warehouse" / "logistics.duckdb"))


def _payload():
    return json.loads(DASHBOARD.read_text())


def test_page_does_not_hardcode_results():
    html = HTML.read_text()
    assert "93.2" not in html
    assert "R$" not in html
    assert "TODO" not in html
    assert "lorem" not in html.lower()


def test_headline_matches_the_warehouse():
    payload = _payload()
    on_time = next(item for item in payload["kpis"] if item["id"] == "on_time")
    con = duckdb.connect(WAREHOUSE, read_only=True)
    try:
        row = con.execute(
            "select orders, measurable_orders, on_time_rate, freight_share_gmv from marts.metric_headline"
        ).fetchone()
    finally:
        con.close()
    assert payload["meta"]["orders"] == row[0]
    assert payload["meta"]["measurable_orders"] == row[1]
    assert abs(on_time["raw"] - row[2]) < 1e-12
    assert row[0] > 90000
    assert 0.5 < row[2] < 0.99
    assert 0 < row[3] < 1


def test_story_has_the_sections_stakeholders_need():
    payload = _payload()
    assert len(payload["kpis"]) == 8
    assert len(payload["insights"]) >= 8
    assert len(payload["recommendations"]) >= 6
    assert len(payload["small"]) >= 5
    assert payload["states"]
    assert payload["lanes"]
    assert payload["weekly"]
    assert payload["categories"]
    blob = json.dumps(payload)
    assert "None" not in blob
    assert "{" not in "".join(item["body"] for item in payload["insights"])
    for item in payload["insights"] + payload["recommendations"] + payload["small"]:
        assert item["title"].strip()
        assert item["body"].strip()


def test_late_reviews_are_worse_than_early_ones():
    payload = _payload()
    bands = {row["band_order"]: row for row in payload["lateness"]}
    early = bands[1]["avg_review"]
    late = bands[6]["avg_review"]
    assert early > 4
    assert late < 3
    assert early - late > 1
