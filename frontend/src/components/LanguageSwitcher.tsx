import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "pt-BR", label: "PT-BR" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="language-switcher">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          className={i18n.resolvedLanguage === lang.code ? "active" : ""}
          onClick={() => void i18n.changeLanguage(lang.code)}
          type="button"
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
