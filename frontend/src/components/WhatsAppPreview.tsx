import { useTranslation } from "react-i18next";
import { renderWhatsAppMarkdown } from "../whatsappMarkdown";
import { Avatar } from "./Avatar";
import { DoubleCheckIcon } from "./icons";

export function WhatsAppPreview({ botName, text, imageUrl }: { botName: string; text: string; imageUrl?: string | null }) {
  const { t } = useTranslation();
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-lg overflow-hidden border border-line">
      <div className="flex items-center gap-3 px-3 py-2 bg-surface-2">
        <Avatar name={botName} size="sm" />
        <div className="min-w-0">
          <div className="text-sm text-text truncate">{botName}</div>
          <div className="text-xs text-muted">{t("composer.previewOnline")}</div>
        </div>
      </div>

      <div className="p-4 min-h-[150px] bg-wa-bg">
        <div className="ml-auto max-w-[85%] w-fit bg-wa-bubble rounded-lg rounded-tr-none px-2 pt-2 pb-1 shadow">
          {imageUrl && <img src={imageUrl} alt="" className="rounded-md mb-1 max-h-48 w-full object-cover" />}
          {text.trim() ? (
            <div
              className="wa-text text-[14.5px] leading-snug text-white break-words"
              dangerouslySetInnerHTML={{ __html: renderWhatsAppMarkdown(text) }}
            />
          ) : (
            <div className="text-white/50 text-sm italic">{t("composer.previewEmpty")}</div>
          )}
          <div className="flex justify-end items-center gap-1 mt-1 text-[11px] text-white/60">
            <span>{time}</span>
            <DoubleCheckIcon className="text-wa-tick" />
          </div>
        </div>
      </div>
    </div>
  );
}
