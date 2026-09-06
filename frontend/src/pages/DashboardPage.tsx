import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setToken, type Session } from "../api";
import { useSocket } from "../useSocket";
import { LinkModal } from "../components/LinkModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SessionStats } from "../components/SessionStats";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function DashboardPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<Session | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const navigate = useNavigate();

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

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const session = await api.createSession(newLabel.trim());
    setNewLabel("");
    setSessions((prev) => [...prev, session]);
    setLinkingId(session.id);
    setQr(null);
    setPairingCode(null);
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

  function logout() {
    setToken(null);
    navigate("/login");
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t("dashboard.title")}</h1>
        <div>
          <Link to="/templates">{t("nav.templates")}</Link>
          <Link to="/scheduled-messages">{t("nav.scheduledMessages")}</Link>
          <LanguageSwitcher />
          <button className="link" onClick={logout}>
            {t("auth.logout")}
          </button>
        </div>
      </header>

      {sessions.length === 0 && (
        <section className="onboarding">
          <div className="onboarding-header">
            <h2>{t("dashboard.onboardingTitle")}</h2>
            <p className="muted">{t("dashboard.onboardingSubtitle")}</p>
          </div>
          <div className="steps">
            {[1, 2, 3, 4].map((n) => (
              <div className="step" key={n}>
                <div className="step-number">{String(n).padStart(2, "0")}</div>
                <h3>{t(`dashboard.step${n}Title`)}</h3>
                <p>{t(`dashboard.step${n}Body`)}</p>
              </div>
            ))}
          </div>
          <div className="feature-grid">
            <div className="feature">
              <div className="feature-icon">🔒</div>
              <h4>{t("dashboard.featureGroupsOnlyTitle")}</h4>
              <p>{t("dashboard.featureGroupsOnlyBody")}</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🔁</div>
              <h4>{t("dashboard.featureReliableTitle")}</h4>
              <p>{t("dashboard.featureReliableBody")}</p>
            </div>
            <div className="feature">
              <div className="feature-icon">📱</div>
              <h4>{t("dashboard.featureMultiNumberTitle")}</h4>
              <p>{t("dashboard.featureMultiNumberBody")}</p>
            </div>
          </div>
        </section>
      )}

      <form className="inline-form" onSubmit={addSession}>
        <input
          placeholder={t("dashboard.labelPlaceholder")}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <button type="submit">{t("dashboard.addNumber")}</button>
      </form>

      <div className="grid">
        {sessions.map((s) => (
          <div className="card" key={s.id}>
            <h3>{s.label}</h3>
            <p className="muted">{s.phoneNumber ?? "—"}</p>
            <span className={`badge badge-${s.status.toLowerCase()}`}>{t(`status.${s.status}`)}</span>

            {s.status === "CONNECTED" && <SessionStats sessionId={s.id} refreshKey={statsRefreshKey} />}

            {s.status === "CONNECTED" ? (
              <Link to={`/sessions/${s.id}`} className="button-link">
                {t("dashboard.viewGroups")}
              </Link>
            ) : (
              <button onClick={() => openLink(s.id)}>{t("dashboard.link")}</button>
            )}
            <button className="link danger" onClick={() => setPendingUnlink(s)}>
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
    </div>
  );
}
