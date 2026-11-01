"""Download the pinned Olist snapshot and land it as Parquet.

The CSV bytes are checked against sha256 pins before anything is written to
the raw layer. Parquet files keep the source columns as strings and add only
`_extracted_at`. Brazilian federal holidays are generated locally by the
`holidays` package (no network call) and landed beside the Olist files as
reference data, not as a transformation of Olist.
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import holidays

ROOT = Path(__file__).resolve().parents[1]
PINS_PATH = Path(__file__).resolve().parent / "pins.json"
LANDING_DIR = ROOT / "data" / "landing"
RAW_DIR = Path(os.environ.get("RAW_DIR", ROOT / "data" / "raw"))
USER_AGENT = "supply-chain-control-tower/1.0 (reproducible public-data extract)"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".partial")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
    tmp.replace(dest)


def _land_parquet(csv_path: Path, parquet_path: Path, extracted_at: str) -> int:
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    try:
        # Source columns stay strings. _extracted_at is the only landing column.
        con.execute(
            f"""
            copy (
                select
                    *,
                    ? as _extracted_at
                from read_csv(?, header = true, all_varchar = true)
            ) to ? (format parquet, compression zstd)
            """,
            [extracted_at, str(csv_path), str(parquet_path)],
        )
        rows = con.execute(
            "select count(*) from read_parquet(?)",
            [str(parquet_path)],
        ).fetchone()[0]
    finally:
        con.close()
    return int(rows)


def _land_holidays(parquet_path: Path, extracted_at: str) -> int:
    """Federal public holidays for 2016–2018 as published by the holidays package.

    Carnival and Corpus Christi are not in that federal list. They are omitted
    on purpose rather than hand-added, and the gap is documented.
    """
    rows = []
    for year in (2016, 2017, 2018):
        calendar = holidays.country_holidays("BR", years=[year])
        for day, name in sorted(calendar.items()):
            rows.append((day.isoformat(), name, extracted_at))
    if not rows:
        raise RuntimeError("holidays package returned no Brazilian federal holidays")
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    try:
        con.execute("create table holidays (holiday_date varchar, holiday_name varchar, _extracted_at varchar)")
        con.executemany("insert into holidays values (?, ?, ?)", rows)
        con.execute(
            f"copy holidays to '{parquet_path.as_posix()}' (format parquet, compression zstd)"
        )
    finally:
        con.close()
    return len(rows)


def extract() -> dict:
    pins = json.loads(PINS_PATH.read_text())
    commit = pins["mirror"]["commit"]
    base = (
        "https://raw.githubusercontent.com/olist/work-at-olist-data/"
        f"{commit}/datasets"
    )
    extracted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    LANDING_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    landed = []
    for spec in pins["files"]:
        csv_path = LANDING_DIR / spec["filename"]
        url = f"{base}/{spec['filename']}"
        if not csv_path.exists() or _sha256(csv_path) != spec["sha256"]:
            _download(url, csv_path)
        actual = _sha256(csv_path)
        if actual != spec["sha256"]:
            raise RuntimeError(
                f"Checksum mismatch for {spec['filename']}: expected {spec['sha256']}, got {actual}"
            )
        parquet_path = RAW_DIR / f"{spec['name']}.parquet"
        rows = _land_parquet(csv_path, parquet_path, extracted_at)
        landed.append({"name": spec["name"], "rows": rows, "sha256": actual, "path": str(parquet_path)})
        print(f"landed {spec['name']}: {rows:,} rows")

    holiday_rows = _land_holidays(RAW_DIR / "holidays.parquet", extracted_at)
    print(f"landed holidays: {holiday_rows} federal holidays")
    manifest = {
        "extracted_at": extracted_at,
        "mirror_commit": commit,
        "files": landed,
        "holidays_rows": holiday_rows,
        "holidays_note": "python-holidays BR federal calendar, 2016-2018, no subdivision",
    }
    (RAW_DIR / "_manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def main() -> None:
    extract()


if __name__ == "__main__":
    main()
