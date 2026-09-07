import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, mediaUrl, type Group, type MessageTemplate, type Session } from "../api";
import { errorMessage } from "../errorMessage";
import { useSocket } from "../useSocket";
import { DatePicker } from "../components/DatePicker";
import { PaperclipIcon } from "../components/icons";
import { WhatsAppPreview } from "../components/WhatsAppPreview";

type Recurrence = "NONE" | "DAILY" | "WEEKLY";
type GroupFilter = "ALL" | "SELECTED" | "UNSELECTED";
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

function roundUpToQuarterHour(base: Date): Date {
  const d = new Date(base);
  d.setSeconds(0, 0);
  const remainder = d.getMinutes() % 15;
  if (remainder !== 0) d.setMinutes(d.getMinutes() + (15 - remainder));
  return d;
}

export function SessionPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionLabel, setSessionLabel] = useState("Cronos");
  const [sessionStatus, setSessionStatus] = useState<Session["status"] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [templateMedia, setTemplateMedia] = useState<{ mediaPath: string; mediaType: "IMAGE" | "DOCUMENT" } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [sendAt, setSendAt] = useState<Date>(() => roundUpToQuarterHour(new Date()));
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [weekdays, setWeekdays] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GroupFilter>("ALL");
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState(0);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  // Computed once per mount rather than inline `new Date()` on every render,
  // so the "can't schedule in the past" boundary doesn't drift as you type.
  const minSendAt = useMemo(() => new Date(), []);
  const selectedMembers = useMemo(
    () => groups.filter((g) => selected.has(g.id)).reduce((sum, g) => sum + g.participantCount, 0),
    [groups, selected],
  );

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (query && !g.name.toLowerCase().includes(query)) return false;
      if (filter === "SELECTED") return selected.has(g.id);
      if (filter === "UNSELECTED") return !selected.has(g.id);
      return true;
    });
  }, [groups, search, filter, selected]);

  // Reset to page 1 whenever the result set or page size changes, so you
  // never land on a now out-of-range page.
  useEffect(() => {
    setPage(0);
  }, [search, filter, limit]);

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / limit));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleGroups = filteredGroups.slice(currentPage * limit, currentPage * limit + limit);
  const previewImageUrl = file ? URL.createObjectURL(file) : templateMedia ? mediaUrl(templateMedia.mediaPath) : null;

  async function load() {
    if (!sessionId) return;
    setGroups(await api.listGroups(sessionId));
  }

  useEffect(() => {
    void load();
    void api.listTemplates().then(setTemplates);
    void api.listSessions().then((sessions) => {
      const current = sessions.find((s) => s.id === sessionId);
      if (current) {
        setSessionLabel(current.label);
        setSessionStatus(current.status);
      }
    });
  }, [sessionId]);

  useSocket((event, payload) => {
    const p = payload as { sessionId: string; status?: Session["status"] };
    if (event === "session:status" && p.sessionId === sessionId && p.status) {
      setSessionStatus(p.status);
    }
  });

  async function refresh() {
    if (!sessionId) return;
    setRefreshing(true);
    try {
      setGroups(await api.refreshGroups(sessionId));
    } catch (err) {
      setStatus(errorMessage(t, err));
    } finally {
      setRefreshing(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleWeekday(day: string) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    setText(template.body);
    setFile(null);
    setTemplateMedia(
      template.mediaPath && template.mediaType ? { mediaPath: template.mediaPath, mediaType: template.mediaType } : null,
    );
  }

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setStatus(null);

    if (selected.size === 0) {
      setStatus(t("composer.selectGroupError"));
      return;
    }
    if (!text.trim() && !file && !templateMedia) {
      setStatus(t("composer.textOrMediaError"));
      return;
    }

    try {
      let mediaPath: string | undefined = templateMedia?.mediaPath;
      let mediaType: "IMAGE" | "DOCUMENT" | undefined = templateMedia?.mediaType;
      if (file) {
        const uploaded = await api.uploadMedia(file);
        mediaPath = uploaded.mediaPath;
        mediaType = uploaded.mediaType;
      }

      const rec = recurrence === "NONE" ? undefined : recurrence === "DAILY" ? "DAILY" : `WEEKLY:${[...weekdays].join(",")}`;

      await api.createScheduledMessage({
        sessionId,
        text: text.trim() || undefined,
        mediaPath,
        mediaType,
        groupIds: [...selected],
        sendAt: sendAt.toISOString(),
        recurrence: rec,
      });

      setStatus(t("composer.scheduled"));
      setText("");
      setFile(null);
      setTemplateMedia(null);
      setSelected(new Set());
    } catch (err) {
      setStatus(errorMessage(t, err));
    }
  }

  const segBtn = (isActive: boolean) =>
    `flex-1 justify-center rounded-md text-sm px-3 py-1.5 ${
      isActive ? "text-accent bg-accent/10 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted"
    }`;

  // Groups and the composer both require a live WhatsApp connection — acting
  // on them while disconnected would just fail, so gate the whole page until
  // the session reconnects instead of letting those actions silently break.
  if (sessionStatus && sessionStatus !== "CONNECTED") {
    return (
      <>
        <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h1 className="text-xl font-medium tracking-tight m-0">{t("groups.title")}</h1>
        </header>
        <div className="card items-center text-center gap-3 py-14 max-w-[480px] mx-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-status-warn" />
          <h2 className="text-base font-medium m-0">{t("groups.disconnectedTitle")}</h2>
          <p className="text-muted text-sm m-0">
            {t("groups.disconnectedBody", { status: t(`status.${sessionStatus}`) })}
          </p>
          <Link to="/dashboard" className="btn btn-solid mt-2 no-underline">
            {t("groups.goToDashboard")}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-medium tracking-tight m-0">{t("groups.title")}</h1>
        <button className="btn" onClick={refresh} disabled={refreshing}>
          {refreshing ? t("groups.refreshing") : t("groups.refresh")}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_372px] gap-6 items-start">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              className="field-input flex-1 min-w-[160px]"
              placeholder={t("groups.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="field-input w-auto flex-1 sm:flex-none min-w-[140px]"
              value={filter}
              onChange={(e) => setFilter(e.target.value as GroupFilter)}
            >
              <option value="ALL">{t("groups.filterAll")}</option>
              <option value="SELECTED">{t("groups.filterSelected")}</option>
              <option value="UNSELECTED">{t("groups.filterUnselected")}</option>
            </select>
            <select
              className="field-input w-auto flex-1 sm:flex-none min-w-[100px]"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {t("groups.limitOption", { count: n })}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="table min-w-[480px]">
              <thead>
                <tr>
                  <th></th>
                  <th>{t("groups.name")}</th>
                  <th>{t("groups.participants")}</th>
                  <th>{t("groups.lastSynced")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((g) => (
                  <tr key={g.id} onClick={() => toggle(g.id)} className={selected.has(g.id) ? "selected" : ""}>
                    <td>
                      <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
                    </td>
                    <td>{g.name}</td>
                    <td>{g.participantCount}</td>
                    <td>{new Date(g.lastSyncedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {visibleGroups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted">
                      {t("groups.noMatches")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 -mt-2 mb-4">
            <p className="text-muted text-[0.82em] m-0">
              {t("groups.shownCount", { shown: visibleGroups.length, total: filteredGroups.length })}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary py-1 px-2.5 text-xs"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {t("groups.prevPage")}
                </button>
                <span className="text-muted text-xs font-mono">
                  {t("groups.pageOf", { page: currentPage + 1, pages: pageCount })}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary py-1 px-2.5 text-xs"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  {t("groups.nextPage")}
                </button>
              </div>
            )}
          </div>
        </div>

        <form className="card" onSubmit={schedule}>
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[15px] m-0 font-medium">{t("composer.title")}</h2>
            {templates.length > 0 && (
              <select
                className="ml-auto text-xs bg-transparent border-0 text-accent"
                defaultValue=""
                onChange={(e) => e.target.value && applyTemplate(e.target.value)}
              >
                <option value="">{t("composer.useTemplate")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-text/70">{t("composer.messagePlaceholder")}</span>
            <textarea className="field-input" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            <div className="flex justify-between text-[10px] font-mono text-muted">
              <span>{text.length} / 4096</span>
            </div>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-text/70">{t("composer.preview")}</span>
            <WhatsAppPreview botName={sessionLabel} text={text} imageUrl={previewImageUrl} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-text/70">{t("composer.attachment")}</span>
            <label
              className={`dropzone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) {
                  setFile(dropped);
                  setTemplateMedia(null);
                }
              }}
            >
              <PaperclipIcon className="text-muted" />
              {file ? (
                <span className="text-[12.5px] text-text">{file.name}</span>
              ) : templateMedia ? (
                <span className="text-[12.5px] text-text">{t("composer.fromTemplate")}</span>
              ) : (
                <span className="font-mono text-[11px] text-muted">{t("composer.dropHint")}</span>
              )}
              <span className="btn-ghost">{t("composer.chooseFile")}</span>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  setFile(chosen);
                  if (chosen) setTemplateMedia(null);
                }}
              />
            </label>
            {(file || templateMedia) && (
              <button
                type="button"
                className="btn-link-danger"
                onClick={() => {
                  setFile(null);
                  setTemplateMedia(null);
                }}
              >
                {t("composer.removeAttachment")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-text/70">{t("composer.sendAt")}</span>
              <DatePicker selected={sendAt} onChange={setSendAt} minDate={minSendAt} showTime aria-label={t("composer.sendAt")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-text/70">{t("composer.timezone")}</span>
              <div className="field-input text-muted">{timezone}</div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-text/70">{t("composer.recurrence")}</span>
            <div className="flex w-full rounded-md border border-line overflow-hidden">
              <button type="button" className={segBtn(recurrence === "NONE")} onClick={() => setRecurrence("NONE")}>
                {t("composer.oneTime")}
              </button>
              <button type="button" className={segBtn(recurrence === "DAILY")} onClick={() => setRecurrence("DAILY")}>
                {t("composer.daily")}
              </button>
              <button type="button" className={segBtn(recurrence === "WEEKLY")} onClick={() => setRecurrence("WEEKLY")}>
                {t("composer.weekly")}
              </button>
            </div>
          </div>

          {recurrence === "WEEKLY" && (
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`rounded-md text-[0.8em] px-2.5 py-1.5 ${
                    weekdays.has(d) ? "text-accent bg-accent/10 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted border border-line"
                  }`}
                  onClick={() => toggleWeekday(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {selected.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-accent/10 shadow-[inset_0_0_0_1px_rgba(20,192,101,0.35)] text-[12.5px] text-accent-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
              <span>{t("groups.selectedCount", { count: selected.size })}</span>
              {selectedMembers > 0 && <span className="font-mono">&middot; {selectedMembers}</span>}
            </div>
          )}

          {status && <div className="text-danger text-sm">{status}</div>}
          <button type="submit" className="btn btn-solid btn-block py-2.5">
            {t("composer.schedule")}
          </button>
        </form>
      </div>
    </>
  );
}
