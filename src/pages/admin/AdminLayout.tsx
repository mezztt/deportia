import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon from "../../components/Icons";
import { ADMIN_TOKEN_KEY, THEME_KEY } from "../../config";
import { useState } from "react";
import Tour, { startTour } from "../../components/tour/Tour";
import { adminSteps } from "../../components/tour/steps";
import { DeportiaLogo, MezzttLink, SidebarSignature } from "../../components/Brand";

const NAV = [
  { section: "GESTIÓN" },
  { path: "/admin", icon: "home", label: "Inicio" },
  { path: "/admin/complejos", icon: "systems", label: "Complejos" },
  { path: "/admin/pagos", icon: "cash", label: "Pagos" },
  { path: "/admin/facturacion", icon: "invoice", label: "Facturación" },
  { section: "SISTEMA" },
  { path: "/admin/configuracion", icon: "settings", label: "Configuración" },
] as const;

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
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
            <strong>Deportia</strong>
            <span>Panel general · <MezzttLink /></span>
          </div>
        </div>

        <nav className="sidebar-nav" data-tour="menu">
          {NAV.map((item, i) =>
            "section" in item ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <button
                key={item.path}
                data-tour={`nav-${item.path.split("/")[2] || "inicio"}`}
                className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <span aria-hidden="true"><Icon name={item.icon} /></span>
                <span className="nav-item-text">{item.label}</span>
              </button>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <SidebarSignature />
          <button className="logout-button" data-tour="tema" onClick={toggleTheme} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon"><Icon name={theme === "dark" ? "sun" : "moon"} size={15} />{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button className="logout-button" onClick={startTour} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon">¿Cómo funcionamos?</span>
          </button>
          <button className="logout-button" onClick={logout}>
            <span className="nav-item-text with-icon"><Icon name="logout" size={15} />Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <main className="page-content">
          <Outlet />
        </main>
        <Tour steps={adminSteps} storageKey="deportia_superadmin_x" />
      </div>
    </div>
  );
}

export default AdminLayout;
