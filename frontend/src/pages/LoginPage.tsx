import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setToken } from "../api";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = mode === "login" ? await api.login(email, password) : await api.register(email, password);
      setToken(token);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="centered">
      <div className="login-language-switcher">
        <LanguageSwitcher />
      </div>
      <form className="card" onSubmit={submit}>
        <h1>{t("app.title")}</h1>
        <p className="muted">{t("app.tagline")}</p>
        <input placeholder={t("auth.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          placeholder={t("auth.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit">{mode === "login" ? t("auth.login") : t("auth.register")}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? t("auth.needAccount") : t("auth.haveAccount")}
        </button>
      </form>
    </div>
  );
}
