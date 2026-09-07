import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setToken, type Session } from "../api";
import { useSocket } from "../useSocket";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Avatar } from "./Avatar";
import { formatPhoneNumber } from "../formatPhone";
import { MenuIcon, CloseIcon } from "./icons";

export type ShellSection = "dashboard" | "groups" | "schedule" | "templates" | "metrics";

const STATUS_DOT: Record<Session["status"], string> = {
  CONNECTED: "bg-status-good shadow-[0_0_8px_var(--color-status-good)]",
  AWAITING_LINK: "bg-status-warn",
  AWAITING_SCAN: "bg-status-info",
  AWAITING_CODE: "bg-status-info",
  DISCONNECTED: "bg-status-warn",
  EXPIRED: "bg-status-bad",
  REMOVED: "bg-status-bad",
};

function sectionFromPath(pathname: string): ShellSection {
  if (pathname.startsWith("/sessions/")) return "groups";
  if (pathname.startsWith("/scheduled-messages")) return "schedule";
  if (pathname.startsWith("/templates")) return "templates";
  if (pathname.startsWith("/metrics")) return "metrics";
  return "dashboard";
}

function ContentFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-muted">…</p>
    </div>
  );
}

// A persistent layout route (see App.tsx) rather than a per-page wrapper —
// so the sidebar, its session list, and its WebSocket connection all stay
// mounted across page navigations instead of unmounting/remounting (which
// looked like a full page reload) on every route change.
export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const active = sectionFromPath(location.pathname);
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    void api.listSessions().then(setSessions);
  }, []);

  // The drawer is a mobile-only affordance — once a link is followed the
  // route changes and it should get out of the way automatically, otherwise
  // it stays covering the new page.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useSocket((event, payload) => {
    if (event === "session:status") {
      const p = payload as { sessionId: string; status?: Session["status"] };
      setSessions((prev) => prev.map((s) => (s.id === p.sessionId ? { ...s, status: p.status! } : s)));
    }
    // This sidebar is a persistent layout (mounted once, not per-page), so it
    // only ever fetches the session list on that first mount — these keep it
    // in sync with numbers added/renamed/unlinked from elsewhere (e.g. the
    // dashboard), which otherwise never reach this separate copy of state.
    if (event === "session:created") {
      const s = payload as Session;
      setSessions((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
    }
    if (event === "session:renamed") {
      const s = payload as Session;
      setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)));
    }
    if (event === "session:removed") {
      const p = payload as { sessionId: string };
      setSessions((prev) => prev.filter((x) => x.id !== p.sessionId));
    }
  });

  const groupsTarget = routeSessionId ?? sessions.find((s) => s.status === "CONNECTED")?.id;

  function logout() {
    setToken(null);
    window.location.href = "/login";
  }

  const navLink = (isActive: boolean) =>
    `flex items-center gap-2 shrink-0 px-2.5 py-1.5 md:py-2 rounded-md text-sm no-underline ${
      isActive
        ? "text-accent bg-accent/10 shadow-[inset_0_0_0_1px_rgba(20,192,101,0.4)]"
        : "text-text/70 hover:bg-white/5"
    }`;

  return (
    <div className="flex flex-col md:grid md:grid-cols-[232px_minmax(0,1fr)] min-h-screen bg-bg">
      <div className="flex md:hidden items-center justify-between gap-3 p-3 bg-surface border-b border-line sticky top-0 z-30">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-1.5 no-underline text-text font-medium text-base shrink-0">
          <img src="/logo.png" alt="" className="w-5 h-5 object-contain shrink-0" />
          <span>{t("app.title")}</span>
        </Link>
        <button
          type="button"
          aria-label={t("nav.openMenu")}
          onClick={() => setMobileNavOpen(true)}
          className="p-1.5 -m-1.5 text-text/80 hover:text-text"
        >
          <MenuIcon />
        </button>
      </div>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`bg-surface border-line flex flex-col fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-200 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:static md:z-auto md:w-auto md:max-w-none md:border-r md:h-screen md:sticky md:top-0`}
      >
        <div className="flex flex-col items-stretch gap-6 p-3">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" className="flex items-center gap-2.5 px-1.5 no-underline text-text font-medium text-base shrink-0">
              <img src="/logo.png" alt="" className="w-5 h-5 object-contain shrink-0" />
              <span>{t("app.title")}</span>
            </Link>
            <button
              type="button"
              aria-label={t("nav.closeMenu")}
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden p-1.5 -m-1.5 text-text/80 hover:text-text"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="flex flex-col gap-0.5">
            <span className="block font-mono text-[9.5px] tracking-[0.13em] uppercase text-muted px-1.5 pb-2">
              {t("nav.sectionOperation")}
            </span>
            <Link to={groupsTarget ? `/sessions/${groupsTarget}` : "/dashboard"} className={navLink(active === "groups")}>
              <span className="w-1 h-1 rounded-full bg-current opacity-60 inline-block" />
              {t("groups.title")}
            </Link>
            <Link to="/scheduled-messages" className={navLink(active === "schedule")}>
              <span className="w-1 h-1 rounded-full bg-current opacity-60 inline-block" />
              {t("nav.scheduledMessages")}
            </Link>
            <Link to="/templates" className={navLink(active === "templates")}>
              <span className="w-1 h-1 rounded-full bg-current opacity-60 inline-block" />
              {t("nav.templates")}
            </Link>
            <Link to="/metrics" className={navLink(active === "metrics")}>
              <span className="w-1 h-1 rounded-full bg-current opacity-60 inline-block" />
              {t("nav.metrics")}
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0 px-3.5">
          <span className="block font-mono text-[9.5px] tracking-[0.13em] uppercase text-muted px-1.5 pb-2">
            {t("nav.sectionNumbers")}
          </span>
          {sessions
            .filter((s) => s.status !== "REMOVED")
            .map((s) => (
              <Link
                to={`/sessions/${s.id}`}
                key={s.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-md no-underline text-text shrink-0 ${
                  s.id === routeSessionId ? "bg-white/6" : "hover:bg-white/4"
                }`}
              >
                <Avatar name={s.label} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{s.label}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s.status]}`} />
                  </div>
                  <div className="font-mono text-[10.5px] text-muted truncate">
                    {formatPhoneNumber(s.phoneNumber) ?? t(`status.${s.status}`)}
                  </div>
                </div>
              </Link>
            ))}
          <Link to="/dashboard" className="btn btn-secondary shrink-0 mt-1.5 justify-start text-[13px] w-full no-underline">
            + {t("dashboard.addNumber")}
          </Link>
        </div>

        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-line border-dashed">
          <LanguageSwitcher />
          <button type="button" className="btn-link" onClick={logout}>
            {t("auth.logout")}
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-5 md:px-10 md:py-8 md:pb-12">
        <Suspense fallback={<ContentFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
