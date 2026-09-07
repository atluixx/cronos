import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePicker } from "../components/DatePicker";
import { api, type DailyMetric, type Session, type SessionStats, type TopGroup } from "../api";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 170;

function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateParam(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Shown before any real sends exist, so the chart/list shapes are visible
// from day one instead of an empty state that explains nothing.
const PLACEHOLDER_TOP_GROUPS: TopGroup[] = [
  { groupId: "placeholder-1", name: "—", participantCount: null, sent: 100 },
  { groupId: "placeholder-2", name: "—", participantCount: null, sent: 68 },
  { groupId: "placeholder-3", name: "—", participantCount: null, sent: 42 },
  { groupId: "placeholder-4", name: "—", participantCount: null, sent: 18 },
];

function DailyChart({ data }: { data: DailyMetric[] }) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.sent, d.failed]));
  const barWidth = data.length > 0 ? CHART_WIDTH / data.length : 0;
  const gap = Math.min(6, barWidth * 0.25);
  const columnWidth = Math.max(1, barWidth - gap);
  const subGap = 2;
  const subWidth = Math.max(1, (columnWidth - subGap) / 2);
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} style={{ width: "100%", height: 190, display: "block" }} role="img">
        <line x1="0" y1={CHART_HEIGHT - 20} x2={CHART_WIDTH} y2={CHART_HEIGHT - 20} stroke="var(--color-line)" strokeWidth={1} />
        {data.map((d, i) => {
          const columnX = i * barWidth + gap / 2;
          const sentHeight = (d.sent / max) * (CHART_HEIGHT - 40);
          const failedHeight = (d.failed / max) * (CHART_HEIGHT - 40);
          const opacity = hover === null || hover === i ? 1 : 0.4;
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              style={{ cursor: "pointer" }}
            >
              {/* Full-column invisible hit area — makes low/zero bars easy to hover too. */}
              <rect x={i * barWidth} y={0} width={barWidth} height={CHART_HEIGHT} fill="transparent" />
              <rect
                x={columnX}
                y={CHART_HEIGHT - 20 - sentHeight}
                width={subWidth}
                height={sentHeight}
                rx={2}
                fill="var(--color-accent)"
                opacity={opacity}
              />
              <rect
                x={columnX + subWidth + subGap}
                y={CHART_HEIGHT - 20 - failedHeight}
                width={subWidth}
                height={failedHeight}
                rx={2}
                fill="var(--color-danger)"
                opacity={opacity}
              />
            </g>
          );
        })}
      </svg>
      {hovered && hover !== null && (
        <div
          className="absolute -top-1 -translate-x-1/2 -translate-y-full pointer-events-none bg-surface-2 border border-line-strong rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg z-10"
          style={{ left: `${((hover + 0.5) * barWidth * 100) / CHART_WIDTH}%` }}
        >
          <div className="font-mono text-muted mb-1">
            {new Date(hovered.date).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
          </div>
          <div className="text-status-good">
            {t("metrics.sent")}: <span className="font-mono">{hovered.sent}</span>
          </div>
          {hovered.failed > 0 && (
            <div className="text-danger">
              {t("stats.failed")}: <span className="font-mono">{hovered.failed}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MetricsPage() {
  const { t, i18n } = useTranslation();
  const [rangeTo, setRangeTo] = useState<Date>(() => new Date());
  const [rangeFrom, setRangeFrom] = useState<Date>(() => daysAgo(13));
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [topGroups, setTopGroups] = useState<TopGroup[]>([]);
  const [rows, setRows] = useState<{ session: Session; stats: SessionStats }[]>([]);

  // Default the range to "since this number/bot was first used" instead of a
  // fixed lookback window that includes days before the account existed.
  useEffect(() => {
    void api.getFirstActivity().then(({ date }) => {
      if (date) setRangeFrom(parseDateParam(date));
    });
  }, []);

  useEffect(() => {
    void api.getDailyMetrics({ from: toDateParam(rangeFrom), to: toDateParam(rangeTo) }).then(setDaily);
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    void api.getTopGroups(5).then(setTopGroups);
  }, []);

  useEffect(() => {
    void (async () => {
      const sessions = await api.listSessions();
      const withStats = await Promise.all(
        sessions
          .filter((s) => s.status !== "REMOVED")
          .map(async (session) => ({ session, stats: await api.getSessionStats(session.id) })),
      );
      setRows(withStats);
    })();
  }, []);

  // Sent/failed come from the same `daily` dataset the chart renders, so the
  // summary cards and the chart can never disagree — and both include
  // history from numbers you've since unlinked, matching what "keep history
  // for your records" on unlink actually promises. Groups/numbers are
  // structural counts, scoped to currently-linked numbers only.
  const totals = daily.reduce(
    (acc, d) => ({ sent: acc.sent + d.sent, failed: acc.failed + d.failed }),
    { sent: 0, failed: 0 },
  );
  const totalGroups = rows.reduce((sum, r) => sum + r.stats.groupsCount, 0);
  const deliveryRate = totals.sent + totals.failed > 0 ? (totals.sent / (totals.sent + totals.failed)) * 100 : null;
  const hasTopGroups = topGroups.length > 0;
  const displayedTopGroups = hasTopGroups ? topGroups : PLACEHOLDER_TOP_GROUPS;
  const maxTopGroupSent = Math.max(1, ...displayedTopGroups.map((g) => g.sent));

  return (
    <>
      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-medium tracking-tight m-0">{t("metrics.title")}</h1>
        <div className="flex items-center gap-2">
          <div className="w-[130px]">
            <DatePicker
              selected={rangeFrom}
              onChange={(date) => setRangeFrom(date)}
              maxDate={rangeTo}
              aria-label={t("metrics.rangeFrom")}
            />
          </div>
          <span className="text-muted text-sm">{t("metrics.rangeToSeparator")}</span>
          <div className="w-[130px]">
            <DatePicker
              selected={rangeTo}
              onChange={(date) => setRangeTo(date)}
              minDate={rangeFrom}
              maxDate={new Date()}
              aria-label={t("metrics.rangeTo")}
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-2">
        <div className="card p-4 gap-1">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent">{t("metrics.sent")}</span>
          <span className="text-[28px] font-medium tracking-tight">{totals.sent}</span>
        </div>
        <div className="card p-4 gap-1">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent">{t("metrics.delivery")}</span>
          <span className="text-[28px] font-medium tracking-tight">{deliveryRate !== null ? `${deliveryRate.toFixed(1)}%` : "—"}</span>
          <span className="font-mono text-[10.5px] text-muted">{t("metrics.failedCount", { count: totals.failed })}</span>
        </div>
        <div className="card p-4 gap-1">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent">{t("metrics.groups")}</span>
          <span className="text-[28px] font-medium tracking-tight">{totalGroups}</span>
        </div>
        <div className="card p-4 gap-1">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent">{t("metrics.numbers")}</span>
          <span className="text-[28px] font-medium tracking-tight">{rows.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4.5 my-6">
        <div className="card">
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-[15px] m-0 font-medium">{t("metrics.dailyChartTitle")}</h3>
            <div className="ml-auto flex items-center gap-3 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent" />
                {t("metrics.sent")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-danger" />
                {t("stats.failed")}
              </span>
            </div>
          </div>
          <DailyChart data={daily} />
        </div>

        <div className="card">
          <h3 className="text-[15px] m-0 mb-3.5 font-medium">{t("metrics.topGroupsTitle")}</h3>
          <div className={`flex flex-col gap-3 ${hasTopGroups ? "" : "opacity-35"}`}>
            {displayedTopGroups.map((g) => (
              <div key={g.groupId}>
                <div className="flex justify-between text-[12.5px] mb-1">
                  <span>{g.name}</span>
                  <span className="font-mono">{hasTopGroups ? g.sent : "—"}</span>
                </div>
                <div className="h-[5px] rounded-full bg-white/7">
                  <div
                    className={`h-full rounded-full ${hasTopGroups ? "bg-accent" : "bg-muted"}`}
                    style={{ width: `${(g.sent / maxTopGroupSent) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!hasTopGroups && <p className="text-muted text-[0.82em] mt-3 mb-0">{t("metrics.noDataYet")}</p>}
        </div>
      </div>

      <h2 className="text-[15px] font-medium tracking-tight mt-8 mb-1">{t("metrics.byNumber")}</h2>
      <p className="text-muted text-[0.8em] mt-0 mb-3">{t("metrics.byNumberHint")}</p>
      <div className="overflow-x-auto">
      <table className="table min-w-[560px]">
        <thead>
          <tr>
            <th>{t("metrics.number")}</th>
            <th>{t("stats.totalSent")}</th>
            <th>{t("stats.failed")}</th>
            <th>{t("stats.groups")}</th>
            <th>{t("stats.lastActivity")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ session, stats }) => (
            <tr key={session.id}>
              <td>{session.label}</td>
              <td className="font-mono">{stats.totalSent}</td>
              <td className="font-mono">{stats.totalFailed}</td>
              <td className="font-mono">{stats.groupsCount}</td>
              <td className="font-mono">
                {stats.lastActivityAt ? new Date(stats.lastActivityAt).toLocaleString(i18n.language) : t("stats.never")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
