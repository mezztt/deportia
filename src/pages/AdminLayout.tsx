import { Outlet, useLocation, useNavigate } from "react-router-dom";

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("velora_admin_token");
    window.location.href = "/";
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">M</div>
          <div className="sidebar-brand-text">
            <strong>Mezztt</strong>
            <span>Panel de control</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">GESTIÓN</div>

          <button
            className={`nav-item ${location.pathname === "/admin/systems" ? "active" : ""}`}
            onClick={() => navigate("/admin/systems")}
          >
            <span>◈</span>
            <span className="nav-item-text">Sistemas</span>
          </button>

          <button
            className={`nav-item ${location.pathname === "/admin/payments" ? "active" : ""}`}
            onClick={() => navigate("/admin/payments")}
          >
            <span>💵</span>
            <span className="nav-item-text">Pagos</span>
          </button>

          <div className="nav-section">SISTEMA</div>

          <button
            className={`nav-item ${location.pathname === "/admin/settings" ? "active" : ""}`}
            onClick={() => navigate("/admin/settings")}
          >
            <span>⚙</span>
            <span className="nav-item-text">Configuración</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-button" onClick={logout}>
            <span className="nav-item-text">↪ Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;



