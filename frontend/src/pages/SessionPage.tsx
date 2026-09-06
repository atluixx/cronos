import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type Group, type MessageTemplate } from "../api";

type Recurrence = "NONE" | "DAILY" | "WEEKLY";
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export function SessionPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sendAt, setSendAt] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [weekdays, setWeekdays] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!sessionId) return;
    setGroups(await api.listGroups(sessionId));
  }

  useEffect(() => {
    void load();
    void api.listTemplates().then(setTemplates);
  }, [sessionId]);

  async function refresh() {
    if (!sessionId) return;
    setRefreshing(true);
    try {
      setGroups(await api.refreshGroups(sessionId));
    } catch (err) {
      setStatus((err as Error).message);
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
    if (template) setText(template.body);
  }

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setStatus(null);

    if (selected.size === 0) {
      setStatus(t("composer.selectGroupError"));
      return;
    }
    if (!text.trim() && !file) {
      setStatus(t("composer.textOrMediaError"));
      return;
    }

    try {
      let mediaPath: string | undefined;
      let mediaType: "IMAGE" | "DOCUMENT" | undefined;
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
        sendAt: new Date(sendAt).toISOString(),
        recurrence: rec,
      });

      setStatus(t("composer.scheduled"));
      setText("");
      setFile(null);
      setSelected(new Set());
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t("groups.title")}</h1>
        <div>
          <Link to="/">{t("nav.back")}</Link>
          <Link to="/scheduled-messages">{t("nav.scheduledMessages")}</Link>
        </div>
      </header>

      <button onClick={refresh} disabled={refreshing}>
        {refreshing ? t("groups.refreshing") : t("groups.refresh")}
      </button>

      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th>{t("groups.name")}</th>
            <th>{t("groups.participants")}</th>
            <th>{t("groups.lastSynced")}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} onClick={() => toggle(g.id)} className={selected.has(g.id) ? "selected" : ""}>
              <td>
                <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
              </td>
              <td>{g.name}</td>
              <td>{g.participantCount}</td>
              <td>{new Date(g.lastSyncedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t("composer.title")}</h2>
      <form className="card" onSubmit={schedule}>
        {templates.length > 0 && (
          <select defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
            <option value="">{t("composer.useTemplate")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        )}

        <textarea placeholder={t("composer.messagePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
        <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        <label>
          {t("composer.sendAt")}
          <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} required />
        </label>

        <label>
          {t("composer.recurrence")}
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="NONE">{t("composer.oneTime")}</option>
            <option value="DAILY">{t("composer.daily")}</option>
            <option value="WEEKLY">{t("composer.weekly")}</option>
          </select>
        </label>

        {recurrence === "WEEKLY" && (
          <div className="weekday-picker">
            {WEEKDAYS.map((d) => (
              <button type="button" key={d} className={weekdays.has(d) ? "active" : ""} onClick={() => toggleWeekday(d)}>
                {d}
              </button>
            ))}
          </div>
        )}

        <p className="muted">{t("groups.selectedCount", { count: selected.size })}</p>
        {status && <div className="error">{status}</div>}
        <button type="submit">{t("composer.schedule")}</button>
      </form>
    </div>
  );
}
