import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type SessionStats as Stats } from "../api";

export function SessionStats({ sessionId, refreshKey }: { sessionId: string; refreshKey?: number }) {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.getSessionStats(sessionId).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshKey]);

  if (!stats) return null;

  if (stats.totalSent === 0 && stats.totalFailed === 0) {
    return <p className="text-muted text-sm my-1">{t("dashboard.noStatsYet")}</p>;
  }

  const dt = "font-mono text-[0.78em] uppercase tracking-[0.04em] text-muted";
  const dd = "m-0 font-semibold text-[1.2em] tracking-tight";

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 my-1 text-sm">
      <div>
        <dt className={dt}>{t("stats.totalSent")}</dt>
        <dd className={dd}>{stats.totalSent}</dd>
      </div>
      <div>
        <dt className={dt}>{t("stats.sentThisWeek")}</dt>
        <dd className={dd}>{stats.sentThisWeek}</dd>
      </div>
      <div>
        <dt className={dt}>{t("stats.sentThisMonth")}</dt>
        <dd className={dd}>{stats.sentThisMonth}</dd>
      </div>
      <div>
        <dt className={dt}>{t("stats.failed")}</dt>
        <dd className={`${dd} ${stats.totalFailed > 0 ? "text-danger" : ""}`}>{stats.totalFailed}</dd>
      </div>
      <div>
        <dt className={dt}>{t("stats.groups")}</dt>
        <dd className={dd}>{stats.groupsCount}</dd>
      </div>
      <div>
        <dt className={dt}>{t("stats.lastActivity")}</dt>
        <dd className={dd}>{stats.lastActivityAt ? new Date(stats.lastActivityAt).toLocaleString(i18n.language) : t("stats.never")}</dd>
      </div>
    </dl>
  );
}
