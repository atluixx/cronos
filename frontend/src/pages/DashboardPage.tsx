import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type Session } from "../api";
import { useSocket } from "../useSocket";
import { LinkModal } from "../components/LinkModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SessionStats } from "../components/SessionStats";
import { Avatar } from "../components/Avatar";
import { formatPhoneNumber } from "../formatPhone";
import { LockIcon, RefreshIcon, SmartphoneIcon } from "../components/icons";

const STATUS_TEXT: Record<Session["status"], string> = {
  CONNECTED: "text-status-good",
  AWAITING_LINK: "text-status-warn",
  AWAITING_SCAN: "text-status-info",
  AWAITING_CODE: "text-status-info",
  DISCONNECTED: "text-status-warn",
  EXPIRED: "text-danger",
  REMOVED: "text-danger",
};

export function DashboardPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<Session | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function load() {
    setSessions(await api.listSessions());
  }

  useEffect(() => {
    void load();
  }, []);

  useSocket((event, payload) => {
    const p = payload as { sessionId: string; status?: Session["status"]; qr?: string; code?: string };
    if (event === "session:status") {
      setSessions((prev) => prev.map((s) => (s.id === p.sessionId ? { ...s, status: p.status! } : s)));
      if (p.status === "CONNECTED") {
        setLinkingId((cur) => (cur === p.sessionId ? null : cur));
        setQr(null);
        setPairingCode(null);
        setStatsRefreshKey((k) => k + 1);
      }
    }
    if (event === "session:qr" && p.sessionId === linkingId) setQr(p.qr!);
    if (event === "session:pairing-code" && p.sessionId === linkingId) setPairingCode(p.code!);
    if (event === "schedule:result") setStatsRefreshKey((k) => k + 1);
  });

  // No name required up front, WhatsApp-Web-style — auto-generate one and let
  // people rename it later, rather than blocking linking on typing a label
  // (which silently no-op'd before with zero feedback if left empty).
  async function addSession() {
    setAdding(true);
    try {
      const n = sessions.filter((s) => s.status !== "REMOVED").length + 1;
      const session = await api.createSession(t("dashboard.defaultLabel", { n }));
      setSessions((prev) => [...prev, session]);
      setLinkingId(session.id);
      setQr(null);
      setPairingCode(null);
    } finally {
      setAdding(false);
    }
  }

  function openLink(id: string) {
    setLinkingId(id);
    setQr(null);
    setPairingCode(null);
  }

  async function confirmUnlink() {
    if (!pendingUnlink) return;
    await api.deleteSession(pendingUnlink.id);
    setSessions((prev) => prev.filter((s) => s.id !== pendingUnlink.id));
    setPendingUnlink(null);
  }

  function startEdit(s: Session) {
    setEditingId(s.id);
    setEditValue(s.label);
  }

  async function commitEdit() {
    const id = editingId;
    const value = editValue.trim();
    setEditingId(null);
    if (!id || !value) return;
    const current = sessions.find((s) => s.id === id);
    if (!current || current.label === value) return;
    const updated = await api.renameSession(id, value);
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  return (
    <>
      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-xl font-medium tracking-tight m-0">{t("dashboard.title")}</h1>
      </header>

      {sessions.length === 0 && (
        <section className="mb-8">
          <div className="mb-6">
            <h2 className="text-[1.4em] font-medium tracking-tight m-0 mb-1.5">{t("dashboard.onboardingTitle")}</h2>
            <p className="text-muted text-sm">{t("dashboard.onboardingSubtitle")}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-7">
            {[1, 2, 3, 4].map((n) => (
              <div className="card gap-2" key={n}>
                <div className="font-mono text-[0.8em] text-accent">{String(n).padStart(2, "0")}</div>
                <h3 className="m-0 text-base font-semibold">{t(`dashboard.step${n}Title`)}</h3>
                <p className="m-0 text-muted text-[0.88em]">{t(`dashboard.step${n}Body`)}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <div>
              <LockIcon className="text-accent mb-2" width={22} height={22} />
              <h4 className="m-0 mb-1 text-[0.95em] font-semibold">{t("dashboard.featureGroupsOnlyTitle")}</h4>
              <p className="m-0 text-muted text-[0.85em]">{t("dashboard.featureGroupsOnlyBody")}</p>
            </div>
            <div>
              <RefreshIcon className="text-accent mb-2" width={22} height={22} />
              <h4 className="m-0 mb-1 text-[0.95em] font-semibold">{t("dashboard.featureReliableTitle")}</h4>
              <p className="m-0 text-muted text-[0.85em]">{t("dashboard.featureReliableBody")}</p>
            </div>
            <div>
              <SmartphoneIcon className="text-accent mb-2" width={22} height={22} />
              <h4 className="m-0 mb-1 text-[0.95em] font-semibold">{t("dashboard.featureMultiNumberTitle")}</h4>
              <p className="m-0 text-muted text-[0.85em]">{t("dashboard.featureMultiNumberBody")}</p>
            </div>
          </div>
        </section>
      )}

      <button className="btn mb-6" onClick={() => void addSession()} disabled={adding}>
        + {t("dashboard.addNumber")}
      </button>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {sessions.map((s) => (
          <div className="card" key={s.id}>
            <div className="flex items-center gap-3">
              <Avatar name={s.label} />
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <input
                    autoFocus
                    className="field-input py-1 text-base font-semibold"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void commitEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <h3
                    className="m-0 text-base font-semibold truncate cursor-text hover:underline decoration-dashed"
                    title={t("dashboard.renameHint")}
                    onClick={() => startEdit(s)}
                  >
                    {s.label}
                  </h3>
                )}
                <p className="text-muted text-sm m-0">{formatPhoneNumber(s.phoneNumber) ?? "—"}</p>
              </div>
            </div>
            <span className={`badge-dot ${STATUS_TEXT[s.status]}`}>{t(`status.${s.status}`)}</span>

            {s.status === "CONNECTED" && <SessionStats sessionId={s.id} refreshKey={statsRefreshKey} />}

            {s.status === "CONNECTED" ? (
              <Link to={`/sessions/${s.id}`} className="btn no-underline">
                {t("dashboard.viewGroups")}
              </Link>
            ) : (
              <button className="btn" onClick={() => openLink(s.id)}>
                {t("dashboard.link")}
              </button>
            )}
            <button className="btn-link-danger" onClick={() => setPendingUnlink(s)}>
              {t("dashboard.unlink")}
            </button>
          </div>
        ))}
      </div>

      {linkingId && (
        <LinkModal
          sessionId={linkingId}
          qr={qr}
          pairingCode={pairingCode}
          onClose={() => {
            setLinkingId(null);
            setQr(null);
            setPairingCode(null);
          }}
        />
      )}

      {pendingUnlink && (
        <ConfirmDialog
          title={t("dashboard.unlinkConfirmTitle")}
          body={t("dashboard.unlinkConfirmBody")}
          confirmLabel={t("dashboard.confirm")}
          cancelLabel={t("dashboard.cancel")}
          onConfirm={() => void confirmUnlink()}
          onCancel={() => setPendingUnlink(null)}
        />
      )}
    </>
  );
}
