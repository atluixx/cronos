import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

// Braille-block paper plane, matching the design mock's hero glyph.
const PLANE_ART = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣴⣾⣿⣿⣿⡄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⣶⣿⣿⡿⠿⠛⢙⣿⣿⠃
⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣶⣾⣿⣿⠿⠛⠋⠁⠀⠀⠀⣸⣿⣿⠀
⠀⠀⠀⠀⣀⣤⣴⣾⣿⣿⡿⠟⠛⠉⠀⠀⣠⣤⠞⠁⠀⠀⣿⣿⡇⠀
⠀⣴⣾⣿⣿⡿⠿⠛⠉⠀⠀⠀⢀⣠⣶⣿⠟⠁⠀⠀⠀⢸⣿⣿⠀⠀
⠸⣿⣿⣿⣧⣄⣀⠀⠀⣀⣴⣾⣿⣿⠟⠁⠀⠀⠀⠀⠀⣼⣿⡿⠀⠀
⠀⠈⠙⠻⠿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⢠⣿⣿⠇⠀⠀
⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⡇⠀⣀⣄⡀⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠸⣿⣿⣿⣠⣾⣿⣿⣿⣦⡀⠀⠀⣿⣿⡏⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⡿⠋⠈⠻⣿⣿⣦⣸⣿⣿⠁⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠛⠁⠀⠀⠀⠀⠈⠻⣿⣿⣿⠏⠀⠀⠀⠀`;

const divider =
  "h-px bg-[linear-gradient(to_right,transparent,var(--color-line)_48px,var(--color-line)_calc(100%-48px),transparent)]";

export function LandingPage() {
  const { t } = useTranslation();
  const isAuthed = Boolean(localStorage.getItem("token"));
  const homeLink = isAuthed ? "/dashboard" : "/login";

  return (
    <div className="bg-bg">
      <nav className="flex items-center flex-wrap gap-3 md:gap-7 px-4 md:px-14 py-3.5 md:py-4.5 max-w-[1280px] mx-auto">
        <span className="flex items-center gap-2.5 mr-auto">
          <img src="/logo.png" alt="" className="w-5 h-5 object-contain shrink-0" />
          <span className="font-medium">{t("app.title")}</span>
        </span>
        <a href="#steps" className="hidden sm:inline text-text/75 hover:text-text no-underline text-sm">
          {t("landing.navFeatures")}
        </a>
        <Link to={homeLink} className="text-text/75 hover:text-text no-underline text-sm">
          {isAuthed ? t("landing.goToDashboard") : t("landing.login")}
        </Link>
        <Link
          to={homeLink}
          className="inline-flex items-center px-4 md:px-5 py-2 md:py-2.5 text-sm md:text-[15px] rounded-md no-underline bg-accent text-accent-contrast font-medium border border-accent hover:opacity-90"
        >
          {isAuthed ? t("landing.ctaSecondary") : t("landing.getStarted")}
        </Link>
        <LanguageSwitcher />
      </nav>
      <div className={divider} />

      <section className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-8 md:gap-12 items-center max-w-[1280px] mx-auto px-4 md:px-14 py-10 md:py-20 pb-10 md:pb-[74px]">
        <div>
          <h1 className="text-4xl md:text-[52px] leading-[1.1] md:leading-[1.08] tracking-[-0.03em] m-0 mb-1 font-medium">
            {t("landing.heroTitleLine1")}
          </h1>
          <h1 className="text-4xl md:text-[52px] leading-[1.1] md:leading-[1.08] tracking-[-0.03em] m-0 mb-4 md:mb-5 font-medium">
            {t("landing.heroTitleLine2")}
          </h1>
          <p className="text-base md:text-[16.5px] leading-relaxed max-w-[460px] text-muted mb-6 md:mb-7.5">
            {t("landing.heroBody")}
          </p>
          <div className="flex gap-3 items-center flex-wrap">
            <Link
              to={homeLink}
              className="inline-flex items-center px-5 py-2.5 text-[15px] rounded-md no-underline bg-accent text-accent-contrast font-medium border border-accent hover:opacity-90"
            >
              {t("landing.ctaPrimary")}
            </Link>
            <Link
              to={homeLink}
              className="inline-flex items-center px-5 py-2.5 text-[15px] rounded-md no-underline text-accent border border-accent hover:bg-accent/10"
            >
              {t("landing.ctaSecondary")}
            </Link>
          </div>
        </div>

        <div className="relative grid place-items-center py-4 md:py-7.5 overflow-hidden">
          <div className="absolute -inset-7.5 bg-[radial-gradient(55%_55%_at_58%_42%,rgba(20,192,101,0.2),transparent_70%)] blur-sm" />
          <div className="relative max-w-full overflow-x-auto overflow-y-hidden">
            <pre
              role="img"
              aria-label={t("landing.planeAlt")}
              className="m-0 text-[13px] md:text-[20px] leading-none text-accent-strong"
              style={{ fontFamily: "'DejaVu Sans Mono','Menlo',ui-monospace,monospace", textShadow: "0 0 22px rgba(20,192,101,0.35)" }}
            >
              {PLANE_ART}
            </pre>
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 md:px-14 pt-10 md:pt-[74px] pb-5" id="steps">
        <h2 className="text-2xl md:text-[32px] tracking-[-0.025em] m-0 mb-2.5 font-medium">{t("landing.stepsTitle")}</h2>
        <p className="text-[15.5px] text-muted max-w-[520px] mb-8 md:mb-10">{t("landing.stepsSubtitle")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(["step1", "step2", "step3"] as const).map((step) => (
            <div key={step} className="card shadow-md">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent">{t(`landing.${step}Kicker`)}</span>
              <span className="text-[17px] font-medium">{t(`landing.${step}Title`)}</span>
              <p className="text-[13.5px] text-muted m-0">{t(`landing.${step}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 md:px-14 pt-10 md:pt-14 pb-10 md:pb-[74px]">
        <div className={`${divider} mb-8 md:mb-11`} />
        <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-10">
          <div>
            <h3 className="text-xl md:text-[26px] tracking-[-0.02em] m-0 mb-2 font-medium">{t("landing.finalTitle")}</h3>
            <p className="text-[14.5px] text-muted m-0">{t("landing.finalBody")}</p>
          </div>
          <Link
            to={homeLink}
            className="inline-flex items-center justify-center px-5 py-2.5 text-[15px] rounded-md no-underline bg-accent text-accent-contrast font-medium border border-accent hover:opacity-90 md:ml-auto"
          >
            {isAuthed ? t("landing.goToDashboard") : t("landing.finalCta")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1280px] mx-auto px-4 md:px-14 py-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <span className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-5 h-5 object-contain shrink-0" />
            <span className="font-medium">{t("app.title")}</span>
          </span>
          <p className="m-0 text-[13.5px] text-muted">{t("landing.footerTagline")}</p>
          <nav className="flex items-center gap-5 md:ml-auto">
            <a href="#steps" className="text-text/75 hover:text-text no-underline text-sm">
              {t("landing.navFeatures")}
            </a>
            <Link to={homeLink} className="text-text/75 hover:text-text no-underline text-sm">
              {isAuthed ? t("landing.goToDashboard") : t("landing.login")}
            </Link>
          </nav>
        </div>
        <div className="max-w-[1280px] mx-auto px-4 md:px-14 pb-8 text-[12.5px] text-muted">
          {t("landing.footerRights", { year: new Date().getFullYear() })}
        </div>
      </footer>
    </div>
  );
}
