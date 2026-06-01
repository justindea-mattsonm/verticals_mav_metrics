import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verticals MAV Metrics",
  description: "Custom dashboard reading Hex-built rollups from Neon Postgres.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
              <a href="/" className="text-lg font-semibold tracking-tight">
                Verticals MAV Metrics
              </a>
              <nav className="text-sm text-slate-600 space-x-4">
                <a href="/" className="hover:text-slate-900">Home</a>
                <a href="/sparta" className="hover:text-slate-900">Sparta</a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
          <footer className="mx-auto max-w-7xl px-6 py-6 text-xs text-slate-500">
            Data: Hex → Neon → Vercel. ISR revalidates hourly.
          </footer>
        </div>
      </body>
    </html>
  );
}
