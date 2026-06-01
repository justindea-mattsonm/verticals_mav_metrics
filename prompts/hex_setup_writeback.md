# Hex setup — write 5 dataframes to Neon

> **Paste this whole file into the Hex in-app agent** of the project
> **"Sparta Dash V2 — owner-based rollups"** (UUID
> `019e76b6-947c-776c-8c71-af44124f2952`). The agent is good at creating
> Writeback / CODE cells; the CLI cannot.

## Goal

Write 5 in-project dataframes into Neon Postgres so that the
`verticals_mav_metrics` Next.js app (deployed on Vercel) can read them.
Schedule the project nightly so the tables stay fresh.

## Prerequisites (already done outside Hex)

- Neon database provisioned via the **Vercel ↔ Neon Marketplace integration**
  on the Vercel project `verticals-mav-metrics`.
- Tables created via `db/migrations/0001_initial.sql` (snake_case columns,
  primary keys defined).
- The Vercel-Neon `DATABASE_URL` value has been copied into a **Hex Workspace
  Secret** named `NEON_WRITEBACK_URL`. Verify under **Settings → Secrets**.

## What to create

Create **one new Python CODE cell** at the bottom of the project, after all
existing SQL cells. Cell label: `Write rollups to Neon`. Use the source below
verbatim. (Writeback cells are first-class in Hex, but a single CODE cell is
strictly simpler to reason about and lets us order the 5 UPSERTs with explicit
error handling; pick this path unless you have a strong reason to switch.)

```python
import os
import pandas as pd
from sqlalchemy import create_engine, text

# Read the workspace secret. Hex injects workspace secrets as env vars at run time.
db_url = os.environ["NEON_WRITEBACK_URL"]
engine = create_engine(db_url, pool_pre_ping=True, connect_args={"sslmode": "require"})

# Map each in-project dataframe -> Neon table -> primary key columns -> column rename map.
# The rename map normalizes Hex's quoted-identifier column names to the snake_case
# column names defined in 0001_initial.sql.
TABLES = [
    {
        "df": overview_rollup_current_values,
        "table": "overview_rollup_current_values",
        "pk": ["world_type", "stage"],
        "rename": {
            "Stage": "stage",
            "Current in stage (WIP)": "current_in_stage_wip",
            "Median age (hours)": "median_age_hours",
            "Sum current age (hours)": "sum_current_age_hours",
            "Sample size (1d)": "sample_size_1d",
            "Sample size (3d)": "sample_size_3d",
            "Sample size (7d)": "sample_size_7d",
            "Throughput (1d / day)": "throughput_1d_per_day",
            "Throughput (3d / day)": "throughput_3d_per_day",
            "Throughput (7d / day)": "throughput_7d_per_day",
            "Wall time (1d hours)": "wall_time_1d_hours",
            "Wall time (3d hours)": "wall_time_3d_hours",
            "Wall time (7d hours)": "wall_time_7d_hours",
            "Median(sum) wall time (7d hours)": "median_sum_wall_time_7d_hours",
            "Δ vs avg(sum) (7d hours)": "delta_vs_avg_sum_7d_hours",
            "Median revisits per stage (7d trailing)": "median_revisits_per_stage_7d",
            "Approval rate (1d %)": "approval_rate_1d_pct",
            "Approval rate (3d %)": "approval_rate_3d_pct",
            "Approval rate (7d %)": "approval_rate_7d_pct",
            "Yield (lifetime %)": "yield_lifetime_pct",
            "Yield (1d %)": "yield_1d_pct",
            "Yield (3d %)": "yield_3d_pct",
            "Yield (7d %)": "yield_7d_pct",
        },
    },
    {
        "df": rollup_metrics_trailing_14d,
        "table": "rollup_metrics_trailing_14d",
        "pk": ["day_anchor", "world_type", "rollup_stage"],
        "rename": {},
    },
    {
        "df": staffing_user_rollup,
        "table": "staffing_user_rollup",
        "pk": ["user_id"],
        "rename": {},
    },
    # The two below are NEW cells. If they don't exist yet, create them first
    # using the schemas in this file's "New SQL cells" section below.
    {
        "df": wip_active_aht_by_rollup,
        "table": "wip_active_aht_by_rollup",
        "pk": ["world_type", "rollup_stage"],
        "rename": {},
    },
    {
        "df": completed_active_aht_by_rollup,
        "table": "completed_active_aht_by_rollup",
        "pk": ["world_type", "rollup_stage"],
        "rename": {},
    },
]


def upsert(df: pd.DataFrame, table: str, pk: list[str], rename: dict[str, str]) -> int:
    if df is None or len(df) == 0:
        print(f"[writeback] skip {table} (empty dataframe)")
        return 0

    out = df.rename(columns=rename).copy()

    # Keep only columns that exist in the target table.
    with engine.connect() as conn:
        cols = [
            r[0]
            for r in conn.execute(
                text(
                    "select column_name from information_schema.columns "
                    "where table_schema = 'public' and table_name = :t"
                ),
                {"t": table},
            ).fetchall()
        ]
    keep = [c for c in out.columns if c in cols]
    out = out[keep]

    # Stamp build time.
    out["_built_at"] = pd.Timestamp.utcnow()

    # Staging-table swap so the live table never goes empty.
    staging = f"{table}__staging"
    with engine.begin() as conn:
        conn.execute(text(f"drop table if exists {staging}"))
        conn.execute(text(f"create table {staging} (like {table} including all)"))
    out.to_sql(staging, engine, if_exists="append", index=False, method="multi", chunksize=1000)

    pk_cols = ", ".join(pk)
    update_cols = [c for c in keep + ["_built_at"] if c not in pk]
    set_clause = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
    insert_cols = ", ".join(keep + ["_built_at"])

    with engine.begin() as conn:
        # Anti-join delete: remove rows from live that aren't in staging (full refresh).
        conn.execute(
            text(
                f"delete from {table} t where not exists ("
                f"  select 1 from {staging} s where "
                + " and ".join(f"s.{c} = t.{c}" for c in pk)
                + ")"
            )
        )
        # UPSERT staging -> live.
        conn.execute(
            text(
                f"insert into {table} ({insert_cols}) "
                f"select {insert_cols} from {staging} "
                f"on conflict ({pk_cols}) do update set {set_clause}"
            )
        )
        conn.execute(text(f"drop table {staging}"))

    print(f"[writeback] {table}: wrote {len(out)} rows")
    return len(out)


total = 0
for spec in TABLES:
    try:
        total += upsert(spec["df"], spec["table"], spec["pk"], spec["rename"])
    except Exception as e:
        print(f"[writeback] FAILED {spec['table']}: {e}")
        raise

print(f"[writeback] total rows written: {total}")
```

## New SQL cells (only create if missing)

If `wip_active_aht_by_rollup` and `completed_active_aht_by_rollup` don't
already exist as DataFrame SQL cells, create them. They both query
`stage_metrics_trailing_14d` and `stage_rollup_map` (already in the project).

### Cell `wip_active_aht_by_rollup` (SQL, DataFrame)

```sql
-- Per (world_type, rollup_stage): how many tasks are currently WIP, and the
-- distribution of active hours they've consumed so far.
with anchor as (
    select max(day_anchor) as latest_day from stage_metrics_trailing_14d
),
wip as (
    select
        s.world_type,
        srm.rollup_stage,
        s.task_id,
        sum(s.active_min_1d) / 60.0 as task_active_hours
    from stage_metrics_trailing_14d s
    join stage_rollup_map srm
      on srm.world_type = s.world_type
     and srm.raw_stage  = s.raw_stage
    cross join anchor a
    where s.day_anchor = a.latest_day
      and coalesce(s.is_currently_in_stage, false) = true
    group by 1, 2, 3
)
select
    world_type,
    rollup_stage,
    count(distinct task_id)                     as n_wip_tasks,
    avg(task_active_hours)                      as wip_active_aht_hours,
    median(task_active_hours)                   as wip_active_aht_median_hours,
    sum(task_active_hours)                      as wip_total_active_hours
from wip
group by 1, 2
order by 1, 2;
```

### Cell `completed_active_aht_by_rollup` (SQL, DataFrame)

```sql
-- Per (world_type, rollup_stage): count of tasks completed in trailing
-- 1/3/7-day windows, and the average active-hours per completed task.
with completions as (
    select
        s.world_type,
        srm.rollup_stage,
        s.task_id,
        s.day_anchor,
        sum(s.active_min_1d) / 60.0 as task_active_hours
    from stage_metrics_trailing_14d s
    join stage_rollup_map srm
      on srm.world_type = s.world_type
     and srm.raw_stage  = s.raw_stage
    where coalesce(s.completed_this_day, false) = true
    group by 1, 2, 3, 4
),
ref as (select max(day_anchor) as latest from stage_metrics_trailing_14d)
select
    c.world_type,
    c.rollup_stage,
    count(distinct case when c.day_anchor >  (select latest - 1 from ref) then c.task_id end) as n_completed_1d,
    count(distinct case when c.day_anchor >  (select latest - 3 from ref) then c.task_id end) as n_completed_3d,
    count(distinct case when c.day_anchor >  (select latest - 7 from ref) then c.task_id end) as n_completed_7d,
    avg(case when c.day_anchor >  (select latest - 1 from ref) then c.task_active_hours end)  as completed_active_aht_1d,
    avg(case when c.day_anchor >  (select latest - 3 from ref) then c.task_active_hours end)  as completed_active_aht_3d,
    avg(case when c.day_anchor >  (select latest - 7 from ref) then c.task_active_hours end)  as completed_active_aht_7d
from completions c
group by 1, 2
order by 1, 2;
```

> **NOTE**: The schema for these two new cells is a best-effort sketch — the
> referenced columns (`is_currently_in_stage`, `completed_this_day`,
> `active_min_1d`, `raw_stage`) follow the conventions in the existing
> trailing-14d cells. If any column name differs in the project, the Hex agent
> should fix it locally and tell us what changed so we can update the
> writeback rename map and the Neon column definition (in
> `db/migrations/0002_*.sql`).

## Verification steps

After creating the cell(s):

1. **Run the writeback cell.** Should print 5 `[writeback] <table>: wrote N
   rows` lines, no exception.
2. **Verify the Neon side.** From a terminal with `DATABASE_URL` set:

   ```bash
   psql "$DATABASE_URL" -c "select table_name, (select count(*) from information_schema.columns where table_name = t.table_name) as cols from information_schema.tables t where table_schema='public' order by 1;"
   ```

   Expect 5 tables plus `_migrations`.

3. **Confirm row counts roughly match the Hex dataframes** (use Hex's
   dataframe preview row count vs `select count(*) from <table>` in Neon).

4. **Schedule the project** to run nightly: Hex → Schedule → Daily, e.g. 04:00
   UTC. The writeback cell runs last in execution order, so the tables are
   only overwritten if all upstream cells succeed.

## Rollback / safety

- The writeback uses a staging-table swap inside a transaction — the live
  table will never be empty.
- If a column type mismatch occurs (Hex inferred `float` vs Neon `integer`),
  fix it on the Neon side (`alter table ... alter column ... type ...`) and
  re-run. Don't change Hex-side casts unless the cell logic actually needs to
  change.
- Hex CLI cannot create DataFrame SQL cells (documented limitation). Always
  delegate that to this agent flow.
