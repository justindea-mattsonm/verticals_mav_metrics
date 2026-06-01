import { query, tableExists } from "./db";

/**
 * Typed row shapes mirror the Hex dataframes that Hex writes into Neon.
 * Columns marked optional are best-effort — Hex SQL cells use quoted-identifier
 * camelCase for some columns; the migration normalizes those to snake_case.
 */

export type OverviewRollupRow = {
  world_type: string;
  stage: string;
  current_in_stage_wip: number | null;
  median_age_hours: number | null;
  sum_current_age_hours: number | null;
  sample_size_1d: number | null;
  sample_size_3d: number | null;
  sample_size_7d: number | null;
  throughput_1d_per_day: number | null;
  throughput_3d_per_day: number | null;
  throughput_7d_per_day: number | null;
  wall_time_1d_hours: number | null;
  wall_time_3d_hours: number | null;
  wall_time_7d_hours: number | null;
  median_sum_wall_time_7d_hours: number | null;
  delta_vs_avg_sum_7d_hours: number | null;
  median_revisits_per_stage_7d: number | null;
  approval_rate_1d_pct: number | null;
  approval_rate_3d_pct: number | null;
  approval_rate_7d_pct: number | null;
  yield_lifetime_pct: number | null;
  yield_1d_pct: number | null;
  yield_3d_pct: number | null;
  yield_7d_pct: number | null;
  _built_at: Date | null;
};

export type RollupMetricsTrailing14dRow = {
  day_anchor: string;
  world_type: string;
  rollup_stage: string;
  aht_active_hours_daily: number | null;
  aht_active_hours_1d: number | null;
  aht_active_hours_3d: number | null;
  aht_active_hours_7d: number | null;
  wall_hours_daily: number | null;
  wall_hours_1d: number | null;
  wall_hours_3d: number | null;
  wall_hours_7d: number | null;
  throughput_per_day_daily: number | null;
  throughput_per_day_1d: number | null;
  throughput_per_day_3d: number | null;
  throughput_per_day_7d: number | null;
  active_hours_per_day_daily: number | null;
  active_hours_per_day_1d: number | null;
  active_hours_per_day_3d: number | null;
  active_hours_per_day_7d: number | null;
  review_pass_rate_daily: number | null;
  review_pass_rate_1d: number | null;
  review_pass_rate_3d: number | null;
  review_pass_rate_7d: number | null;
  _built_at: Date | null;
};

export type StaffingUserRollupRow = {
  user_id: string;
  ref_dte: string;
  first_worked_day: string | null;
  last_worked_day: string | null;
  worked_10h_day: string | null;
  days_worked_7_to_14d_ago: number | null;
  role: string | null;
  days_to_10h: number | null;
  days_since_last_worked: number | null;
  lifetime_hours: number | null;
  hours_1d: number | null;
  hours_3d: number | null;
  hours_7d: number | null;
  hours_7_to_14d_ago: number | null;
  active_1d: boolean | null;
  active_3d: boolean | null;
  active_7d: boolean | null;
  new_7d: boolean | null;
  dropped_off_7d: boolean | null;
  is_writer: boolean | null;
  is_reviewer: boolean | null;
  is_labeler: boolean | null;
  active_writer_7d: boolean | null;
  active_reviewer_7d: boolean | null;
  active_labeler_7d: boolean | null;
  _built_at: Date | null;
};

export type WipActiveAhtRow = {
  world_type: string;
  rollup_stage: string;
  n_wip_tasks: number | null;
  wip_active_aht_hours: number | null;
  wip_active_aht_median_hours: number | null;
  wip_total_active_hours: number | null;
  _built_at: Date | null;
};

export type CompletedActiveAhtRow = {
  world_type: string;
  rollup_stage: string;
  n_completed_1d: number | null;
  n_completed_3d: number | null;
  n_completed_7d: number | null;
  completed_active_aht_1d: number | null;
  completed_active_aht_3d: number | null;
  completed_active_aht_7d: number | null;
  _built_at: Date | null;
};

/** Each loader returns `null` if its table hasn't been created yet. */
async function loadIfExists<T>(
  table: string,
  sql: string,
): Promise<T[] | null> {
  if (!(await tableExists(table))) return null;
  const r = await query<T extends Record<string, unknown> ? T : never>(sql);
  return r.rows as unknown as T[];
}

export async function getOverviewRollup(): Promise<OverviewRollupRow[] | null> {
  return loadIfExists<OverviewRollupRow>(
    "overview_rollup_current_values",
    `select * from overview_rollup_current_values
     order by world_type, stage`,
  );
}

export async function getRollupMetricsTrailing14d(): Promise<
  RollupMetricsTrailing14dRow[] | null
> {
  return loadIfExists<RollupMetricsTrailing14dRow>(
    "rollup_metrics_trailing_14d",
    `select * from rollup_metrics_trailing_14d
     order by world_type, rollup_stage, day_anchor`,
  );
}

export async function getStaffingUserRollup(): Promise<
  StaffingUserRollupRow[] | null
> {
  return loadIfExists<StaffingUserRollupRow>(
    "staffing_user_rollup",
    `select * from staffing_user_rollup
     order by last_worked_day desc nulls last
     limit 2000`,
  );
}

export async function getWipActiveAht(): Promise<WipActiveAhtRow[] | null> {
  return loadIfExists<WipActiveAhtRow>(
    "wip_active_aht_by_rollup",
    `select * from wip_active_aht_by_rollup
     order by world_type, rollup_stage`,
  );
}

export async function getCompletedActiveAht(): Promise<
  CompletedActiveAhtRow[] | null
> {
  return loadIfExists<CompletedActiveAhtRow>(
    "completed_active_aht_by_rollup",
    `select * from completed_active_aht_by_rollup
     order by world_type, rollup_stage`,
  );
}

export type TableFreshness = { table: string; built_at: Date | null; row_count: number };

export async function getFreshness(): Promise<TableFreshness[]> {
  const tables = [
    "overview_rollup_current_values",
    "rollup_metrics_trailing_14d",
    "staffing_user_rollup",
    "wip_active_aht_by_rollup",
    "completed_active_aht_by_rollup",
  ];
  const out: TableFreshness[] = [];
  for (const t of tables) {
    if (!(await tableExists(t))) {
      out.push({ table: t, built_at: null, row_count: 0 });
      continue;
    }
    const r = await query<{ built_at: Date | null; row_count: string }>(
      `select max(_built_at) as built_at, count(*)::text as row_count from ${t}`,
    );
    out.push({
      table: t,
      built_at: r.rows[0]?.built_at ?? null,
      row_count: Number(r.rows[0]?.row_count ?? 0),
    });
  }
  return out;
}
