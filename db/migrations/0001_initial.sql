-- 0001_initial.sql
--
-- Initial schema for the 5 Hex-written tables.
-- Idempotent: re-running is safe. Column shapes mirror the Hex SQL cells in
-- the "Sparta Dash V2 — owner-based rollups" project. Hex's writeback will
-- handle UPSERTs on the primary keys defined below.
--
-- Run via the UNPOOLED connection (DATABASE_URL_UNPOOLED). DDL over PgBouncer
-- can fail silently for transactional statements.
--
-- Hex column names that use quoted identifiers (e.g. "Stage", "Current in
-- stage (WIP)", "Δ vs avg(sum) (7d hours)") are normalized to snake_case here.
-- The Hex writeback prompt explicitly aliases the dataframe columns to match
-- these column names; see prompts/hex_setup_writeback.md.

-- =========================================================================
-- 1. overview_rollup_current_values
--    One row per (world_type, stage) with current snapshot KPIs.
-- =========================================================================
create table if not exists overview_rollup_current_values (
    world_type                       text        not null,
    stage                            text        not null,
    current_in_stage_wip             integer,
    median_age_hours                 double precision,
    sum_current_age_hours            double precision,
    sample_size_1d                   integer,
    sample_size_3d                   integer,
    sample_size_7d                   integer,
    throughput_1d_per_day            double precision,
    throughput_3d_per_day            double precision,
    throughput_7d_per_day            double precision,
    wall_time_1d_hours               double precision,
    wall_time_3d_hours               double precision,
    wall_time_7d_hours               double precision,
    median_sum_wall_time_7d_hours    double precision,
    delta_vs_avg_sum_7d_hours        double precision,
    median_revisits_per_stage_7d     double precision,
    approval_rate_1d_pct             double precision,
    approval_rate_3d_pct             double precision,
    approval_rate_7d_pct             double precision,
    yield_lifetime_pct               double precision,
    yield_1d_pct                     double precision,
    yield_3d_pct                     double precision,
    yield_7d_pct                     double precision,
    _built_at                        timestamptz not null default now(),
    primary key (world_type, stage)
);

-- =========================================================================
-- 2. rollup_metrics_trailing_14d
--    Daily series per (world_type, rollup_stage, day_anchor). ~14 rows per
--    rollup, accumulating windowed (1d/3d/7d) values.
-- =========================================================================
create table if not exists rollup_metrics_trailing_14d (
    day_anchor                  date        not null,
    world_type                  text        not null,
    rollup_stage                text        not null,
    aht_active_hours_daily      double precision,
    aht_active_hours_1d         double precision,
    aht_active_hours_3d         double precision,
    aht_active_hours_7d         double precision,
    wall_hours_daily            double precision,
    wall_hours_1d               double precision,
    wall_hours_3d               double precision,
    wall_hours_7d               double precision,
    throughput_per_day_daily    double precision,
    throughput_per_day_1d       double precision,
    throughput_per_day_3d       double precision,
    throughput_per_day_7d       double precision,
    active_hours_per_day_daily  double precision,
    active_hours_per_day_1d     double precision,
    active_hours_per_day_3d     double precision,
    active_hours_per_day_7d     double precision,
    review_pass_rate_daily      double precision,
    review_pass_rate_1d         double precision,
    review_pass_rate_3d         double precision,
    review_pass_rate_7d         double precision,
    _built_at                   timestamptz not null default now(),
    primary key (day_anchor, world_type, rollup_stage)
);

create index if not exists idx_rollup_metrics_trailing_14d_world_stage
    on rollup_metrics_trailing_14d (world_type, rollup_stage, day_anchor desc);

-- =========================================================================
-- 3. staffing_user_rollup
--    One row per expert. ~849 rows for Vigil (per the task brief).
-- =========================================================================
create table if not exists staffing_user_rollup (
    user_id                  text        not null,
    ref_dte                  date,
    first_worked_day         date,
    last_worked_day          date,
    worked_10h_day           date,
    days_worked_7_to_14d_ago integer,
    role                     text,
    days_to_10h              integer,
    days_since_last_worked   integer,
    lifetime_hours           double precision,
    hours_1d                 double precision,
    hours_3d                 double precision,
    hours_7d                 double precision,
    hours_7_to_14d_ago       double precision,
    active_1d                boolean,
    active_3d                boolean,
    active_7d                boolean,
    new_7d                   boolean,
    dropped_off_7d           boolean,
    is_writer                boolean,
    is_reviewer              boolean,
    is_labeler               boolean,
    active_writer_7d         boolean,
    active_reviewer_7d       boolean,
    active_labeler_7d        boolean,
    _built_at                timestamptz not null default now(),
    primary key (user_id)
);

create index if not exists idx_staffing_user_rollup_active_7d
    on staffing_user_rollup (active_7d) where active_7d = true;

create index if not exists idx_staffing_user_rollup_last_worked
    on staffing_user_rollup (last_worked_day desc);

-- =========================================================================
-- 4. wip_active_aht_by_rollup
--    NEW Hex cell (created via Hex's in-app agent). One row per
--    (world_type, rollup_stage).
-- =========================================================================
create table if not exists wip_active_aht_by_rollup (
    world_type                    text not null,
    rollup_stage                  text not null,
    n_wip_tasks                   integer,
    wip_active_aht_hours          double precision,
    wip_active_aht_median_hours   double precision,
    wip_total_active_hours        double precision,
    _built_at                     timestamptz not null default now(),
    primary key (world_type, rollup_stage)
);

-- =========================================================================
-- 5. completed_active_aht_by_rollup
--    NEW Hex cell (created via Hex's in-app agent). One row per
--    (world_type, rollup_stage).
-- =========================================================================
create table if not exists completed_active_aht_by_rollup (
    world_type                   text not null,
    rollup_stage                 text not null,
    n_completed_1d               integer,
    n_completed_3d               integer,
    n_completed_7d               integer,
    completed_active_aht_1d      double precision,
    completed_active_aht_3d      double precision,
    completed_active_aht_7d      double precision,
    _built_at                    timestamptz not null default now(),
    primary key (world_type, rollup_stage)
);

-- =========================================================================
-- Migration log
-- =========================================================================
create table if not exists _migrations (
    name        text primary key,
    applied_at  timestamptz not null default now()
);

insert into _migrations (name) values ('0001_initial')
    on conflict (name) do nothing;
