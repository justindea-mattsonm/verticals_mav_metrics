import {
  getOverviewRollup,
  getRollupMetricsTrailing14d,
  getStaffingUserRollup,
  getFreshness,
  type OverviewRollupRow,
  type RollupMetricsTrailing14dRow,
  type StaffingUserRollupRow,
  type TableFreshness,
} from "@/lib/queries";

export const revalidate = 3600;
export const dynamic = "force-static";

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}

function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(Number(v)).toLocaleString();
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

function fmtDay(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function FreshnessTable({ rows }: { rows: TableFreshness[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Table</th>
            <th className="text-right px-3 py-2 font-medium">Rows</th>
            <th className="text-left px-3 py-2 font-medium">Built at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.table}>
              <td className="px-3 py-2 font-mono text-xs">{r.table}</td>
              <td className="px-3 py-2 text-right">{r.row_count.toLocaleString()}</td>
              <td className="px-3 py-2 text-slate-600">{fmtDate(r.built_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewSection({ rows }: { rows: OverviewRollupRow[] | null }) {
  if (rows === null) {
    return (
      <EmptyState
        title="overview_rollup_current_values"
        hint="Run the migration and the Hex writeback for this table."
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title="No rows yet" hint="Hex writeback may still be in flight." />;
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="text-left px-3 py-2 font-medium">World</th>
            <th className="text-left px-3 py-2 font-medium">Stage</th>
            <th className="text-right px-3 py-2 font-medium">WIP</th>
            <th className="text-right px-3 py-2 font-medium">Throughput 7d/day</th>
            <th className="text-right px-3 py-2 font-medium">Wall 7d (h)</th>
            <th className="text-right px-3 py-2 font-medium">Approval 7d %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={`${r.world_type}-${r.stage}-${i}`}>
              <td className="px-3 py-2">{r.world_type}</td>
              <td className="px-3 py-2">{r.stage}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.current_in_stage_wip)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.throughput_7d_per_day)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.wall_time_7d_hours)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.approval_rate_7d_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrailingMetricsSection({ rows }: { rows: RollupMetricsTrailing14dRow[] | null }) {
  if (rows === null) {
    return (
      <EmptyState
        title="rollup_metrics_trailing_14d"
        hint="Run the migration and the Hex writeback for this table."
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title="No rows yet" hint="Hex writeback may still be in flight." />;
  }
  // Show only the most recent day_anchor per (world_type, rollup_stage) for compactness.
  const latestByKey = new Map<string, RollupMetricsTrailing14dRow>();
  for (const r of rows) {
    const k = `${r.world_type}|${r.rollup_stage}`;
    const existing = latestByKey.get(k);
    if (!existing || (r.day_anchor && existing.day_anchor && r.day_anchor > existing.day_anchor)) {
      latestByKey.set(k, r);
    }
  }
  const latest = Array.from(latestByKey.values()).sort((a, b) =>
    `${a.world_type}|${a.rollup_stage}`.localeCompare(`${b.world_type}|${b.rollup_stage}`),
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="text-left px-3 py-2 font-medium">World</th>
            <th className="text-left px-3 py-2 font-medium">Stage</th>
            <th className="text-left px-3 py-2 font-medium">Day</th>
            <th className="text-right px-3 py-2 font-medium">AHT active 7d (h)</th>
            <th className="text-right px-3 py-2 font-medium">Wall 7d (h)</th>
            <th className="text-right px-3 py-2 font-medium">Throughput 7d/day</th>
            <th className="text-right px-3 py-2 font-medium">Pass rate 7d %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {latest.map((r, i) => (
            <tr key={`${r.world_type}-${r.rollup_stage}-${i}`}>
              <td className="px-3 py-2">{r.world_type}</td>
              <td className="px-3 py-2">{r.rollup_stage}</td>
              <td className="px-3 py-2 text-slate-600">{fmtDay(r.day_anchor)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.aht_active_hours_7d)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.wall_hours_7d)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.throughput_per_day_7d)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.review_pass_rate_7d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffingSection({ rows }: { rows: StaffingUserRollupRow[] | null }) {
  if (rows === null) {
    return (
      <EmptyState
        title="staffing_user_rollup"
        hint="Run the migration and the Hex writeback for this table."
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title="No rows yet" hint="Hex writeback may still be in flight." />;
  }
  const active7d = rows.filter((r) => r.active_7d);
  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        {rows.length.toLocaleString()} staff rows · {active7d.length.toLocaleString()} active in last 7d
      </div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-left px-3 py-2 font-medium">Role</th>
              <th className="text-right px-3 py-2 font-medium">Hours 7d</th>
              <th className="text-right px-3 py-2 font-medium">Lifetime h</th>
              <th className="text-left px-3 py-2 font-medium">Tags</th>
              <th className="text-left px-3 py-2 font-medium">Last worked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {active7d.slice(0, 100).map((r) => (
              <tr key={r.user_id}>
                <td className="px-3 py-2 font-mono text-xs">{r.user_id}</td>
                <td className="px-3 py-2">{r.role ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.hours_7d, 2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.lifetime_hours, 1)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {[r.is_writer && "writer", r.is_reviewer && "reviewer", r.is_labeler && "labeler"]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">{fmtDay(r.last_worked_day)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active7d.length > 100 && (
        <div className="text-xs text-slate-500">
          Showing top 100 of {active7d.length.toLocaleString()} active-7d staff.
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm">
      <div className="font-medium text-slate-800">{title}</div>
      <p className="mt-1 text-slate-600">{hint}</p>
    </div>
  );
}

export default async function SpartaPage() {
  // Run all reads in parallel — server component, no waterfall.
  const [overview, trailing, staffing, freshness] = await Promise.all([
    getOverviewRollup().catch(() => null),
    getRollupMetricsTrailing14d().catch(() => null),
    getStaffingUserRollup().catch(() => null),
    getFreshness().catch(() => [] as TableFreshness[]),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Sparta</h1>
        <p className="mt-2 text-sm text-slate-600">
          Operational rollups for Sanctum / Vigil / Panacea. Source: Hex project
          <code className="ml-1 px-1 rounded bg-slate-100 text-xs">Sparta Dash V2 — owner-based rollups</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Data freshness</h2>
        <FreshnessTable rows={freshness} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Overview — current values per rollup</h2>
        <OverviewSection rows={overview} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Trailing-14d metrics (latest day per rollup)</h2>
        <TrailingMetricsSection rows={trailing} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Staffing</h2>
        <StaffingSection rows={staffing} />
      </section>
    </div>
  );
}
