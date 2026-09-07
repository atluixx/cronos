import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setToken } from "../api";
import { errorMessage } from "../errorMessage";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon } from "../components/icons";

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // A logged-in user landing here (e.g. a stale bookmark, or a link that
  // doesn't know they're authed) should go straight to the app, not be
  // asked to log in again.
  if (localStorage.getItem("token")) return <Navigate to="/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = mode === "login" ? await api.login(email, password) : await api.register(email, password);
      setToken(token);
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  const segBtn = (isActive: boolean) =>
    `flex-1 justify-center rounded-md text-sm px-3 py-1.5 ${
      isActive ? "text-accent bg-accent/10 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(48%_40%_at_50%_28%,var(--color-accent-strong),transparent_70%)] opacity-[0.12] pointer-events-none" />
      <div className="absolute top-5 right-5">
        <LanguageSwitcher />
      </div>

      <div className="card relative w-[min(360px,90vw)] gap-4 shadow-xl">
        <div className="flex items-center gap-2.5 mb-0.5">
          <img src="/logo.png" alt="" className="w-[30px] h-[30px] object-contain shrink-0" />
          <h1 className="m-0 text-[1.4em] font-medium tracking-tight">{t("app.title")}</h1>
        </div>
        <p className="text-muted text-sm -mt-1.5">{t("app.tagline")}</p>

        <div className="inline-flex w-full mt-1 rounded-md border border-line overflow-hidden">
          <button type="button" className={segBtn(mode === "login")} onClick={() => setMode("login")}>
            {t("auth.login")}
          </button>
          <button type="button" className={segBtn(mode === "register")} onClick={() => setMode("register")}>
            {t("auth.register")}
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="relative flex items-center">
            <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="field-input pl-9"
              placeholder={t("auth.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="relative flex items-center">
            <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="field-input pl-9 pr-9"
              placeholder={t("auth.password")}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-text hover:bg-white/7 rounded p-1.5 flex"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </label>

          {error && <div className="text-danger text-sm">{error}</div>}

          <button type="submit" className="btn btn-solid btn-block py-2.5">
            {mode === "login" ? t("auth.login") : t("auth.register")}
            <ArrowRightIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
