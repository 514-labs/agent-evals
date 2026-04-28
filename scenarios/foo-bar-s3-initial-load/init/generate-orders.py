#!/usr/bin/env python3
"""Deterministically seed a realistic mid-scale S3-style export.

Produces ~600K rows of synthetic order data across 15 files in 4 formats
(CSV, gzipped CSV, JSONL, Parquet), partitioned hive-style under the
S3-style prefix. Two replay copies and one schema-drift file simulate the
pathologies a real initial-load workflow has to handle.

Parquet conversion delegates to `clickhouse-client INTO OUTFILE FORMAT Parquet`
so we don't need pyarrow in the base image.

Outputs:
- /data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/<hive-path>/orders.<ext>
- /data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/manifest.csv
- /data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/_seed-totals.json
  (canonical totals — handy when updating assertions; not consumed by the
  scoring framework)
"""

from __future__ import annotations

import csv
import gzip
import json
import os
import random
import shutil
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

SEED = 42
PREFIX_ROOT = Path("/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01")
ROWS_PER_FILE = 40_000

# (relative_path, format, drop_promo_code)
# Days span Jan 2-5 2026; hours chosen to look like a realistic ingest cadence.
VALID_FILES: list[tuple[str, str, bool]] = [
    ("dt=2026-01-02/hour=00/orders.csv",        "csv",     False),
    ("dt=2026-01-02/hour=06/orders.csv",        "csv",     False),
    ("dt=2026-01-02/hour=12/orders.csv.gz",     "csv.gz",  False),
    ("dt=2026-01-02/hour=18/orders.jsonl",      "jsonl",   False),
    ("dt=2026-01-03/hour=00/orders.csv",        "csv",     False),
    ("dt=2026-01-03/hour=08/orders.parquet",    "parquet", False),
    ("dt=2026-01-03/hour=14/orders.csv.gz",     "csv.gz",  False),
    ("dt=2026-01-03/hour=20/orders.jsonl",      "jsonl",   False),
    ("dt=2026-01-04/hour=02/orders.csv",        "csv",     False),
    ("dt=2026-01-04/hour=10/orders.parquet",    "parquet", False),
    ("dt=2026-01-04/hour=16/orders.csv",        "csv",     True),   # schema drift
    ("dt=2026-01-04/hour=22/orders.jsonl",      "jsonl",   False),
    ("dt=2026-01-05/hour=04/orders.csv.gz",     "csv.gz",  False),
    ("dt=2026-01-05/hour=12/orders.parquet",    "parquet", False),
    ("dt=2026-01-05/hour=20/orders.jsonl",      "jsonl",   False),
]

# Two replay copies: one CSV, one Parquet — under archive/replayed/ they share
# the original orders' object lineage but must be filtered by manifest.
REPLAY_COPIES: list[tuple[str, str]] = [
    ("dt=2026-01-02/hour=06/orders.csv",     "archive/replayed/dt=2026-01-02/hour=06/orders.csv"),
    ("dt=2026-01-04/hour=10/orders.parquet", "archive/replayed/dt=2026-01-04/hour=10/orders.parquet"),
]

STATUS_POOL = ["paid"] * 92 + ["refunded"] * 5 + ["failed"] * 3
CHANNEL_POOL = ["web"] * 50 + ["mobile"] * 35 + ["api"] * 15
COUNTRY_POOL = (
    ["US"] * 55 + ["CA"] * 10 + ["GB"] * 10
    + ["DE"] * 7 + ["FR"] * 6 + ["BR"] * 5
    + ["AU"] * 4 + ["JP"] * 3
)
PROMO_POOL = (
    [None] * 70 + ["WINTER10"] * 10 + ["FREESHIP"] * 7
    + ["ENTERPRISE"] * 5 + ["SAVE15"] * 5 + ["LOYALTY20"] * 3
)

COLUMNS = [
    "order_id", "order_ts", "customer_id", "amount_cents",
    "status", "channel", "country", "promo_code", "source_object",
]


def parse_partition(rel_path: str) -> datetime:
    """Extract the partition timestamp from a hive-style path."""
    parts = rel_path.split("/")
    dt = next(p.split("=", 1)[1] for p in parts if p.startswith("dt="))
    hour = next(p.split("=", 1)[1] for p in parts if p.startswith("hour="))
    return datetime.strptime(f"{dt} {hour}", "%Y-%m-%d %H").replace(tzinfo=timezone.utc)


def order_rows(rel_path: str, file_index: int, drop_promo: bool) -> Iterator[dict]:
    """Yield deterministic rows for one source file."""
    rng = random.Random(SEED + file_index)
    base_ts = parse_partition(rel_path)
    object_key = f"initial-load/orders/2026-01/{rel_path}"

    for row_idx in range(ROWS_PER_FILE):
        # Compose order_id from file_index + row_idx so IDs are globally unique.
        order_id = f"ord_{file_index:02d}{row_idx:06d}"
        # Spread timestamps across the hour with some jitter.
        ts = base_ts + timedelta(seconds=rng.randint(0, 3599), microseconds=rng.randint(0, 999_999))
        # Lognormal amount distribution — most orders small, long tail.
        amount = max(50, int(rng.lognormvariate(mu=7.0, sigma=0.8)))

        row = {
            "order_id": order_id,
            "order_ts": ts.isoformat().replace("+00:00", "Z"),
            "customer_id": f"cus_{rng.randint(1, 50_000):06d}",
            "amount_cents": amount,
            "status": rng.choice(STATUS_POOL),
            "channel": rng.choice(CHANNEL_POOL),
            "country": rng.choice(COUNTRY_POOL),
            "promo_code": rng.choice(PROMO_POOL),
            "source_object": object_key,
        }
        if drop_promo:
            row.pop("promo_code")
        yield row


def write_csv(rows: list[dict], out_path: Path, drop_promo: bool) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cols = [c for c in COLUMNS if not (drop_promo and c == "promo_code")]
    with out_path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=cols)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: ("" if row.get(k) is None else row[k]) for k in cols})


def write_csv_gz(rows: list[dict], out_path: Path, drop_promo: bool) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cols = [c for c in COLUMNS if not (drop_promo and c == "promo_code")]
    with gzip.open(out_path, "wt", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=cols)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: ("" if row.get(k) is None else row[k]) for k in cols})


def write_jsonl(rows: list[dict], out_path: Path, drop_promo: bool) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cols = [c for c in COLUMNS if not (drop_promo and c == "promo_code")]
    with out_path.open("w") as fh:
        for row in rows:
            fh.write(json.dumps({k: row.get(k) for k in cols}) + "\n")


def write_parquet(rows: list[dict], out_path: Path, drop_promo: bool, work_dir: Path) -> None:
    """Render Parquet via `clickhouse-local INTO OUTFILE`.

    Uses clickhouse-local (not -client) so we sidestep the server-side
    user_files_path restriction on file() reads. Avoids needing pyarrow
    in the base image; costs one CSV round-trip.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cols = [c for c in COLUMNS if not (drop_promo and c == "promo_code")]
    csv_path = work_dir / (out_path.name + ".csv")
    work_dir.mkdir(parents=True, exist_ok=True)
    write_csv(rows, csv_path, drop_promo)

    schema = ", ".join(_clickhouse_schema(c) for c in cols)
    sql = (
        f"SELECT * FROM file({_quote(str(csv_path))}, 'CSVWithNames', '{schema}') "
        f"INTO OUTFILE {_quote(str(out_path))} FORMAT Parquet"
    )
    subprocess.run(
        ["clickhouse-local", "--query", sql],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    csv_path.unlink()


def _clickhouse_schema(col: str) -> str:
    types = {
        "order_id": "String",
        "order_ts": "String",
        "customer_id": "String",
        "amount_cents": "Int64",
        "status": "String",
        "channel": "String",
        "country": "String",
        "promo_code": "Nullable(String)",
        "source_object": "String",
    }
    return f"{col} {types[col]}"


def _quote(s: str) -> str:
    """SQL-quote a string literal (single quotes)."""
    return "'" + s.replace("'", "''") + "'"


def main() -> int:
    if PREFIX_ROOT.exists():
        shutil.rmtree(PREFIX_ROOT)
    PREFIX_ROOT.mkdir(parents=True, exist_ok=True)
    work_dir = Path("/tmp/dec-bench-seed")
    work_dir.mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict] = []
    totals = {
        "row_count_total": 0,
        "amount_cents_sum": 0,
        "status_counts": Counter(),
        "country_counts": Counter(),
        "channel_counts": Counter(),
        "files": [],
    }

    for file_index, (rel_path, fmt, drop_promo) in enumerate(VALID_FILES):
        out_path = PREFIX_ROOT / rel_path
        rows = list(order_rows(rel_path, file_index, drop_promo))

        if fmt == "csv":
            write_csv(rows, out_path, drop_promo)
        elif fmt == "csv.gz":
            write_csv_gz(rows, out_path, drop_promo)
        elif fmt == "jsonl":
            write_jsonl(rows, out_path, drop_promo)
        elif fmt == "parquet":
            write_parquet(rows, out_path, drop_promo, work_dir)
        else:
            raise ValueError(f"unknown format: {fmt}")

        manifest_rows.append({
            "object_key": f"initial-load/orders/2026-01/{rel_path}",
            "format": fmt,
            "should_load": "true",
            "row_count": len(rows),
        })
        totals["row_count_total"] += len(rows)
        totals["amount_cents_sum"] += sum(r["amount_cents"] for r in rows)
        for r in rows:
            totals["status_counts"][r["status"]] += 1
            totals["country_counts"][r["country"]] += 1
            totals["channel_counts"][r["channel"]] += 1
        totals["files"].append({"object_key": rel_path, "format": fmt, "rows": len(rows), "drop_promo": drop_promo})

    # Replay copies: byte-identical clones in archive/replayed/, manifest marks should_load=false.
    for src_rel, dst_rel in REPLAY_COPIES:
        src_path = PREFIX_ROOT / src_rel
        dst_path = PREFIX_ROOT / dst_rel
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src_path, dst_path)
        # Find original manifest row to preserve format + row count.
        original = next(m for m in manifest_rows if m["object_key"].endswith(src_rel))
        manifest_rows.append({
            "object_key": f"initial-load/orders/2026-01/{dst_rel}",
            "format": original["format"],
            "should_load": "false",
            "row_count": original["row_count"],
        })

    manifest_path = PREFIX_ROOT / "manifest.csv"
    with manifest_path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["object_key", "format", "should_load", "row_count"])
        writer.writeheader()
        writer.writerows(manifest_rows)

    totals_path = PREFIX_ROOT / "_seed-totals.json"
    totals_path.write_text(json.dumps({
        "row_count_total": totals["row_count_total"],
        "amount_cents_sum": totals["amount_cents_sum"],
        "status_counts": dict(totals["status_counts"]),
        "country_counts": dict(totals["country_counts"]),
        "channel_counts": dict(totals["channel_counts"]),
        "valid_file_count": len(VALID_FILES),
        "replay_copy_count": len(REPLAY_COPIES),
        "files": totals["files"],
    }, indent=2, sort_keys=True))

    if work_dir.exists():
        shutil.rmtree(work_dir, ignore_errors=True)

    # Emit a one-line summary suitable for assertion-author copy/paste.
    print(json.dumps({
        "row_count_total": totals["row_count_total"],
        "amount_cents_sum": totals["amount_cents_sum"],
        "status_counts": dict(totals["status_counts"]),
        "valid_file_count": len(VALID_FILES),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
