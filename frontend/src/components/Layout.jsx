import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

function TabLink({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "px-4 py-2 rounded text-sm font-semibold transition",
          isActive
            ? "bg-navy text-white"
            : "text-slate-600 hover:text-navy hover:bg-slate-100",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

// tabs: [{ to, label, end? }]
export default function Layout({ tabs = [] }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth({ status: "down" }));
  }, []);

  const ok = health && health.status === "ok";

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold text-navy">
              Megatron
            </h1>
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-slate-500">
              AI Teaching Assistant
            </span>
          </div>
          {tabs.length > 0 && (
            <nav className="ml-6 flex items-center gap-1">
              {tabs.map((t) => (
                <TabLink key={t.to} to={t.to} end={t.end}>
                  {t.label}
                </TabLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs font-mono">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                ok ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span className="text-slate-500">
              {ok
                ? `api ok · ${health.indexed_chunks} chunks · ${health.model}`
                : "api offline"}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        <Outlet context={{ health }} />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-2 flex justify-between font-mono text-[11px] text-slate-500">
          <span>
            <b className="text-navy">Megatron</b> · Team Megatron · CAS4127
          </span>
          <span>Rebeca Nam &amp; Alexandre Lugovoi</span>
        </div>
      </footer>
    </div>
  );
}
