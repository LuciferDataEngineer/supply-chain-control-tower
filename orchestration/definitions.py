"""Asset graph: pinned extract → dbt build (with tests) → dashboard JSON.

Asset checks re-read the warehouse after dbt so a green materialization means
the closed cohort and the headline rates are actually in the tables.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import duckdb
from dagster import (
    AssetCheckResult,
    AssetCheckSeverity,
    Definitions,
    asset,
    asset_check,
)

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("WAREHOUSE_PATH", str(ROOT / "data" / "warehouse" / "logistics.duckdb"))
os.environ.setdefault("RAW_DIR", str(ROOT / "data" / "raw"))
os.environ.setdefault("DASHBOARD_DIR", str(ROOT / "site"))
os.environ.setdefault("DBT_SEND_ANONYMOUS_USAGE_STATS", "false")
os.environ.setdefault("DO_NOT_TRACK", "1")


def _warehouse():
    return duckdb.connect(os.environ["WAREHOUSE_PATH"], read_only=True)


@asset(group_name="extract", description="Land the pinned Olist snapshot and federal holidays as Parquet.")
def raw_parquet() -> dict:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from ingestion.extract import extract

    return extract()


@asset(
    group_name="transform",
    deps=[raw_parquet],
    description="dbt build of staging, intermediate, the star schema, metric marts, and dbt tests.",
)
def dbt_marts() -> None:
    (ROOT / "data" / "warehouse").mkdir(parents=True, exist_ok=True)
    dbt_bin = shutil.which("dbt") or str(Path.home() / ".local" / "bin" / "dbt")
    env = os.environ.copy()
    env["PATH"] = str(Path.home() / ".local" / "bin") + os.pathsep + env.get("PATH", "")
    subprocess.run(
        [
            dbt_bin,
            "build",
            "--project-dir",
            str(ROOT / "dbt"),
            "--profiles-dir",
            str(ROOT / "dbt"),
        ],
        check=True,
        cwd=str(ROOT),
        env=env,
    )


@asset(
    group_name="publish",
    deps=[dbt_marts],
    description="Turn mart tables into the static dashboard JSON. No figures are typed by hand.",
)
def dashboard_site() -> str:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from analytics.build_dashboard import build

    path = build()
    return str(path)


@asset_check(asset=dbt_marts, description="Closed cohort has the expected coverage of the pinned snapshot.")
def cohort_is_populated() -> AssetCheckResult:
    con = _warehouse()
    try:
        row = con.execute(
            """
            select cohort_orders, cohort_start, cohort_end, geo_source_rows
            from marts.metric_quality
            """
        ).fetchone()
    finally:
        con.close()
    orders, start, end, geo_rows = row
    # The window opens on 1 Jan 2017; the first real order is a few days later.
    passed = (
        orders >= 90000
        and "2017-01-01" <= str(start) <= "2017-01-15"
        and str(end) >= "2018-08-15"
        and geo_rows >= 1_000_000
    )
    if not passed:
        raise RuntimeError(
            f"Closed cohort check failed: orders={orders}, start={start}, end={end}, geo_rows={geo_rows}"
        )
    return AssetCheckResult(
        passed=passed,
        severity=AssetCheckSeverity.ERROR,
        metadata={
            "cohort_orders": int(orders),
            "cohort_start": str(start),
            "cohort_end": str(end),
            "geo_source_rows": int(geo_rows),
        },
    )


@asset_check(asset=dashboard_site, description="Dashboard JSON headline matches the warehouse on-time rate.")
def dashboard_matches_warehouse() -> AssetCheckResult:
    import json

    payload = json.loads((ROOT / "site" / "data" / "dashboard.json").read_text())
    shown = payload["kpis"]
    on_time = next(item["raw"] for item in shown if item["id"] == "on_time")
    con = _warehouse()
    try:
        warehouse_rate = con.execute("select on_time_rate from marts.metric_headline").fetchone()[0]
    finally:
        con.close()
    passed = abs(float(on_time) - float(warehouse_rate)) < 1e-9
    if not passed:
        raise RuntimeError(
            f"Dashboard on-time {on_time} does not match warehouse {warehouse_rate}"
        )
    return AssetCheckResult(
        passed=passed,
        severity=AssetCheckSeverity.ERROR,
        metadata={"dashboard_on_time": float(on_time), "warehouse_on_time": float(warehouse_rate)},
    )


defs = Definitions(
    assets=[raw_parquet, dbt_marts, dashboard_site],
    asset_checks=[cohort_is_populated, dashboard_matches_warehouse],
)
