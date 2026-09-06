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
    return <p className="muted stats-empty">{t("dashboard.noStatsYet")}</p>;
  }

  return (
    <dl className="stats-grid">
      <div>
        <dt>{t("stats.totalSent")}</dt>
        <dd>{stats.totalSent}</dd>
      </div>
      <div>
        <dt>{t("stats.sentThisWeek")}</dt>
        <dd>{stats.sentThisWeek}</dd>
      </div>
      <div>
        <dt>{t("stats.sentThisMonth")}</dt>
        <dd>{stats.sentThisMonth}</dd>
      </div>
      <div>
        <dt>{t("stats.failed")}</dt>
        <dd className={stats.totalFailed > 0 ? "stat-bad" : undefined}>{stats.totalFailed}</dd>
      </div>
      <div>
        <dt>{t("stats.groups")}</dt>
        <dd>{stats.groupsCount}</dd>
      </div>
      <div>
        <dt>{t("stats.lastActivity")}</dt>
        <dd>{stats.lastActivityAt ? new Date(stats.lastActivityAt).toLocaleString(i18n.language) : t("stats.never")}</dd>
      </div>
    </dl>
  );
}
