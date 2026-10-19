import { useEffect, useState } from "react";
import Icon from "../../components/Icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  appApi, canAccess, getSessionUser, MODULE_LABELS, ROLE_LABELS, THEME_KEY, TOKEN_KEY, USER_KEY, longDate,
} from "../../config";
import type { SessionUser } from "../../config";
import NotificationsBell from "../../components/NotificationsBell";
import { DeportiaLogo, SidebarSignature } from "../../components/Brand";
import Assistant from "../../components/Assistant";
import Tour, { startTour } from "../../components/tour/Tour";
import { clientSteps } from "../../components/tour/steps";

const ICONS: Record<string, string> = {
  inicio: "home", turnos: "clock", canchas: "court", facturacion: "invoice", usuarios: "users", configuracion: "settings",
  clientes: "customers", buffet: "cup", torneos: "trophy", reportes: "reports",
};

// Orden del menú y quién puede ver cada módulo
const ORDER = ["inicio", "turnos", "canchas", "clientes", "buffet", "torneos", "facturacion", "reportes", "usuarios", "configuracion"];
// Nombres cortos para el menú
const MENU_LABELS: Record<string, string> = { canchas: "Canchas", buffet: "Buffet", torneos: "Torneos" };
export { canAccess };

function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(getSessionUser());
  const [clock, setClock] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [refreshKey, setRefreshKey] = useState(0);

  // refresca módulos/rol por si los cambiaron desde el panel general
  useEffect(() => {
    appApi<SessionUser>("/auth/me")
      .then((me) => { localStorage.setItem(USER_KEY, JSON.stringify(me)); setUser(me); })
      .catch(() => {});
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const items = ORDER.filter((m) => canAccess(user, m));
  const pathFor = (m: string) => (m === "inicio" ? "/app" : `/app/${m}`);
  const current = ORDER.find((m) => location.pathname === pathFor(m)) || "inicio";

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <DeportiaLogo size={40} />
          <div className="sidebar-brand-text">
            <strong>{user?.company_name || "Deportia"}</strong>
            <span>Deportia</span>
          </div>
        </div>
        <nav className="sidebar-nav" data-tour="menu">
          {items.map((m) => (
            <button key={m} data-tour={`nav-${m}`} className={`nav-item ${current === m ? "active" : ""}`} onClick={() => navigate(pathFor(m))}>
              <span aria-hidden="true"><Icon name={ICONS[m]} /></span>
              <span className="nav-item-text">{MENU_LABELS[m] || MODULE_LABELS[m]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="dp-user-mini">
            <strong>{user?.name}</strong>
            <span>{ROLE_LABELS[user?.role || ""] || user?.role}</span>
          </div>
          <button className="logout-button" data-tour="tema" onClick={toggleTheme} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon"><Icon name={theme === "dark" ? "sun" : "moon"} size={15} />{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button className="logout-button" data-tour="como" onClick={startTour} style={{ marginBottom: 6 }}><span className="nav-item-text with-icon">¿Cómo funcionamos?</span></button>
          <button className="logout-button" onClick={logout}><span className="nav-item-text with-icon"><Icon name="logout" size={15} />Cerrar sesión</span></button>
          <SidebarSignature />
        </div>
      </aside>
      <div className="main-area">
        <header className="dp-topbar">
          <div>
            <span className="dp-topbar-date">{longDate(clock)}</span>
            <strong className="dp-topbar-clock">{clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
          </div>
          <div data-tour="notificaciones"><NotificationsBell onNew={() => setRefreshKey((k) => k + 1)} /></div>
        </header>
        <main className="page-content">
          {/* refreshKey: cuando llega un aviso nuevo, las pantallas se recargan solas */}
          <Outlet context={{ refreshKey }} />
        </main>
        <Assistant user={user} />
        {user && <Tour steps={clientSteps(user)} storageKey={`deportia_${user.role.toLowerCase()}_${user.id ?? "x"}`} />}
      </div>
    </div>
  );
}

export default ClientLayout;
