import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "pt-BR", label: "BR" },
  { code: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="inline-flex gap-0.5 border border-line rounded-md p-0.5">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => void i18n.changeLanguage(lang.code)}
          className={`px-2.5 py-1 text-xs rounded-[6px] border-0 ${
            i18n.resolvedLanguage === lang.code
              ? "bg-surface-2 text-text"
              : "bg-transparent text-muted hover:text-text"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
