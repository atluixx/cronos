import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api";

type Tab = "qr" | "pairing";

export function LinkModal({
  sessionId,
  qr,
  pairingCode,
  onClose,
}: {
  sessionId: string;
  qr: string | null;
  pairingCode: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requesting, setRequesting] = useState(false);

  // Open immediately showing the QR by default, no extra navigation step.
  useEffect(() => {
    void api.linkQr(sessionId);
  }, [sessionId]);

  async function switchToPairing() {
    setTab("pairing");
  }

  async function requestCode() {
    if (!phoneNumber.trim()) return;
    setRequesting(true);
    try {
      await api.linkPairing(sessionId, phoneNumber.trim());
    } finally {
      setRequesting(false);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-md text-sm px-3 py-1.5 ${
      active ? "text-accent bg-accent/10 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted border border-line"
    }`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-medium tracking-tight m-0">{t("link.addTitle")}</h2>
        <div className="flex gap-1 mb-1">
          <button type="button" className={tabClass(tab === "qr")} onClick={() => setTab("qr")}>
            {t("link.qrTab")}
          </button>
          <button type="button" className={tabClass(tab === "pairing")} onClick={() => void switchToPairing()}>
            {t("link.pairingTab")}
          </button>
        </div>

        {tab === "qr" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {qr ? (
              <>
                <QRCodeSVG value={qr} size={340} level="M" className="bg-white p-3.5 rounded-md" />
                <p className="text-muted text-sm">{t("link.scanInstructions")}</p>
              </>
            ) : (
              <p className="text-muted text-sm">{t("link.waitingForQr")}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <input
              className="field-input"
              placeholder={t("link.phoneNumberPlaceholder")}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <button type="button" className="btn" onClick={() => void requestCode()} disabled={requesting}>
              {t("link.requestCode")}
            </button>
            {pairingCode && (
              <>
                <p className="text-muted text-sm">{t("link.enterCodeInstructions")}</p>
                <p className="font-mono text-2xl tracking-[3px] font-medium text-accent-strong">{pairingCode}</p>
              </>
            )}
          </div>
        )}

        <button type="button" className="btn-link" onClick={onClose}>
          {t("dashboard.cancel")}
        </button>
      </div>
    </div>
  );
}
