export const revalidate = 3600;

export default function HomePage() {
  const dashboards = [
    {
      href: "/sparta",
      title: "Sparta",
      blurb:
        "Cross-vertical operational rollups: WIP, throughput, AHT, approval rate, staffing.",
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
        <p className="mt-2 text-sm text-slate-600">
          Live views over Neon Postgres tables that Hex writes on a nightly schedule.
        </p>
      </section>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.map((d) => (
          <li
            key={d.href}
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition"
          >
            <a href={d.href} className="block">
              <div className="text-base font-medium">{d.title}</div>
              <p className="mt-1 text-sm text-slate-600">{d.blurb}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
