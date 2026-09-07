import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";

const AppShell = lazy(() => import("./components/AppShell").then((m) => ({ default: m.AppShell })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const SessionPage = lazy(() => import("./pages/SessionPage").then((m) => ({ default: m.SessionPage })));
const SchedulePage = lazy(() => import("./pages/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })));
const MetricsPage = lazy(() => import("./pages/MetricsPage").then((m) => ({ default: m.MetricsPage })));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function ShellFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <p className="text-muted">…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Suspense fallback={<ShellFallback />}>
                <AppShell />
              </Suspense>
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sessions/:sessionId" element={<SessionPage />} />
          <Route path="/scheduled-messages" element={<SchedulePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
