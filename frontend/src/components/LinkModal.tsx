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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("link.addTitle")}</h2>
        <div className="tabs">
          <button type="button" className={tab === "qr" ? "active" : ""} onClick={() => setTab("qr")}>
            {t("link.qrTab")}
          </button>
          <button type="button" className={tab === "pairing" ? "active" : ""} onClick={() => void switchToPairing()}>
            {t("link.pairingTab")}
          </button>
        </div>

        {tab === "qr" ? (
          <div className="qr-panel">
            {qr ? (
              <>
                <QRCodeSVG value={qr} size={340} level="M" />
                <p className="muted">{t("link.scanInstructions")}</p>
              </>
            ) : (
              <p className="muted">{t("link.waitingForQr")}</p>
            )}
          </div>
        ) : (
          <div className="pairing-panel">
            <input
              placeholder={t("link.phoneNumberPlaceholder")}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <button type="button" onClick={() => void requestCode()} disabled={requesting}>
              {t("link.requestCode")}
            </button>
            {pairingCode && (
              <>
                <p className="muted">{t("link.enterCodeInstructions")}</p>
                <p className="pairing-code">{pairingCode}</p>
              </>
            )}
          </div>
        )}

        <button type="button" className="link" onClick={onClose}>
          {t("dashboard.cancel")}
        </button>
      </div>
    </div>
  );
}
