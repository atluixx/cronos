import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type ScheduledMessage, type SendLog } from "../api";
import { useSocket } from "../useSocket";
import { ConfirmDialog } from "../components/ConfirmDialog";

const STATUS_TEXT: Record<ScheduledMessage["status"], string> = {
  PENDING: "text-status-warn",
  ACTIVE: "text-status-good",
  SENDING: "text-status-info",
  SENT: "text-status-good",
  PARTIAL: "text-status-warn",
  FAILED: "text-danger",
  CANCELLED: "text-muted",
};

export function SchedulePage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, SendLog[]>>({});
  const [pendingCancel, setPendingCancel] = useState<ScheduledMessage | null>(null);

  async function load() {
    setMessages(await api.listScheduledMessages());
  }

  useEffect(() => {
    void load();
  }, []);

  useSocket((event) => {
    if (event === "schedule:result") void load();
  });

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setLogs((prev) => ({ ...prev, [id]: [] }));
    const fetched = await api.getLogs(id);
    setLogs((prev) => ({ ...prev, [id]: fetched }));
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    await api.cancelScheduledMessage(pendingCancel.id);
    setPendingCancel(null);
    void load();
  }

  return (
    <>
      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-medium tracking-tight m-0">{t("schedule.title")}</h1>
      </header>

      {messages.length === 0 && <p className="text-muted text-sm">{t("schedule.empty")}</p>}

      {messages.length > 0 && (
      <div className="overflow-x-auto">
      <table className="table min-w-[640px]">
        <thead>
          <tr>
            <th>{t("schedule.sendAt")}</th>
            <th>{t("schedule.recurrence")}</th>
            <th>{t("schedule.message")}</th>
            <th>{t("schedule.groups")}</th>
            <th>{t("schedule.status")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <React.Fragment key={m.id}>
              <tr onClick={() => toggleExpand(m.id)}>
                <td>{new Date(m.sendAt).toLocaleString()}</td>
                <td>{m.recurrence ?? t("composer.oneTime")}</td>
                <td>{m.text ?? (m.mediaType ? `[${m.mediaType.toLowerCase()}]` : "")}</td>
                <td>{m.targets.length}</td>
                <td>
                  <span className={`badge-dot ${STATUS_TEXT[m.status]}`}>{m.status}</span>
                </td>
                <td>
                  {(m.status === "PENDING" || m.status === "ACTIVE") && (
                    <button
                      className="btn-link-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingCancel(m);
                      }}
                    >
                      {t("schedule.cancel")}
                    </button>
                  )}
                </td>
              </tr>
              {expanded === m.id && (
                <tr>
                  <td colSpan={6}>
                    <ul className="list-none m-0 p-0">
                      {(logs[m.id] ?? []).map((l) => (
                        <li key={l.id} className={l.success ? "text-status-good" : "text-danger"}>
                          {l.group.name} — {l.success ? "sent" : `failed: ${l.errorMessage}`} (
                          {new Date(l.attemptedAt).toLocaleString()})
                        </li>
                      ))}
                      {logs[m.id]?.length === 0 && <li>{t("schedule.noAttempts")}</li>}
                    </ul>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      </div>
      )}

      {pendingCancel && (
        <ConfirmDialog
          title={t("schedule.cancelConfirm")}
          body=""
          confirmLabel={t("dashboard.confirm")}
          cancelLabel={t("dashboard.cancel")}
          onConfirm={() => void confirmCancel()}
          onCancel={() => setPendingCancel(null)}
        />
      )}
    </>
  );
}
