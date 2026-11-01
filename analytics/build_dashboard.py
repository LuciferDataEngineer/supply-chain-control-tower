"""Read the mart tables and write site/data/dashboard.json.

The browser never invents a number. Narration only formats values from these rows.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path

import duckdb

from analytics.narrate import narrate

ROOT = Path(__file__).resolve().parents[1]
WAREHOUSE = os.environ.get("WAREHOUSE_PATH", str(ROOT / "data" / "warehouse" / "logistics.duckdb"))
OUT_DIR = Path(os.environ.get("DASHBOARD_DIR", str(ROOT / "site")))

MODELS = [
    "metric_headline",
    "metric_weekly",
    "metric_monthly",
    "metric_state",
    "metric_lane",
    "metric_cycle",
    "metric_lateness",
    "metric_late_cause",
    "metric_freight_price",
    "metric_freight_region",
    "metric_freight_cheap_geo",
    "metric_freight_weight",
    "metric_seller",
    "metric_category",
    "metric_dow",
    "metric_installments",
    "metric_payment_type",
    "metric_slice",
    "metric_quality",
    "metric_speed_split",
]


def _clean(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()[:10]
    if isinstance(value, float) and value != value:
        return None
    return value


def _rows(con, model: str) -> list[dict]:
    cursor = con.execute(f"select * from marts.{model}")
    columns = [col[0] for col in cursor.description]
    return [{key: _clean(value) for key, value in zip(columns, row)} for row in cursor.fetchall()]


def _heatmap(lanes: list[dict]) -> dict:
    by_customer: dict[str, int] = {}
    by_seller: dict[str, int] = {}
    for lane in lanes:
        by_customer[lane["customer_state"]] = by_customer.get(lane["customer_state"], 0) + lane["orders"]
        by_seller[lane["seller_state"]] = by_seller.get(lane["seller_state"], 0) + lane["orders"]
    customers = [state for state, _ in sorted(by_customer.items(), key=lambda item: -item[1])[:8]]
    sellers = [state for state, _ in sorted(by_seller.items(), key=lambda item: -item[1])[:6]]
    cells = []
    for lane in lanes:
        if lane["seller_state"] in sellers and lane["customer_state"] in customers and lane["orders"] >= 30:
            cells.append({
                "seller": lane["seller_state"],
                "customer": lane["customer_state"],
                "orders": lane["orders"],
                "on_time_rate": lane["on_time_rate"],
                "avg_delivery_days": lane["avg_delivery_days"],
            })
    return {"sellers": sellers, "customers": customers, "cells": cells}


def build() -> Path:
    con = duckdb.connect(WAREHOUSE, read_only=True)
    try:
        loaded = {model: _rows(con, model) for model in MODELS}
    finally:
        con.close()

    bundle = {
        "headline": loaded["metric_headline"][0],
        "weekly": loaded["metric_weekly"],
        "monthly": loaded["metric_monthly"],
        "states": loaded["metric_state"],
        "lanes": loaded["metric_lane"],
        "cycle": loaded["metric_cycle"][0],
        "lateness": loaded["metric_lateness"],
        "causes": loaded["metric_late_cause"],
        "freight_price": loaded["metric_freight_price"],
        "freight_region": loaded["metric_freight_region"],
        "freight_cheap": loaded["metric_freight_cheap_geo"],
        "freight_weight": loaded["metric_freight_weight"],
        "sellers": loaded["metric_seller"],
        "categories": loaded["metric_category"],
        "dow": loaded["metric_dow"],
        "installments": loaded["metric_installments"],
        "payments": loaded["metric_payment_type"],
        "slices": loaded["metric_slice"],
        "quality": loaded["metric_quality"][0],
        "speed_split": loaded["metric_speed_split"],
    }
    story = narrate(bundle)
    quality = bundle["quality"]
    categories = [
        row for row in bundle["categories"]
        if row["orders"] >= 300
    ]
    categories.sort(key=lambda row: row["on_time_rate"])

    payload = {
        "meta": {
            "title": "Delivery control tower",
            "cohort_start": quality["cohort_start"],
            "cohort_end": quality["cohort_end"],
            "orders": bundle["headline"]["orders"],
            "measurable_orders": bundle["headline"]["measurable_orders"],
            "customers": bundle["headline"]["customers"],
            "gmv": bundle["headline"]["gmv"],
            "on_time_rate": bundle["headline"]["on_time_rate"],
        },
        "kpis": story["kpis"],
        "strip": story["strip"],
        "insights": story["insights"],
        "small": story["small"],
        "recommendations": story["recommendations"],
        "takeaways": story["takeaways"],
        "weekly": bundle["weekly"],
        "monthly": bundle["monthly"],
        "states": bundle["states"],
        "lanes": story["lane_opportunities"],
        "heatmap": _heatmap(bundle["lanes"]),
        "cycle": bundle["cycle"],
        "lateness": bundle["lateness"],
        "freight_price": bundle["freight_price"],
        "freight_region": bundle["freight_region"],
        "freight_weight": bundle["freight_weight"],
        "pareto": story["pareto"],
        "watch_sellers": story["watch_sellers"],
        "categories": categories,
        "dow": bundle["dow"],
        "installments": bundle["installments"],
    }
    out = OUT_DIR / "data"
    out.mkdir(parents=True, exist_ok=True)
    path = out / "dashboard.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"wrote {path} ({path.stat().st_size:,} bytes)")
    print(
        f"on-time {payload['kpis'][0]['value']} · "
        f"orders {payload['meta']['orders']:,} · "
        f"insights {len(payload['insights'])}"
    )
    return path


def main() -> None:
    build()


if __name__ == "__main__":
    main()
