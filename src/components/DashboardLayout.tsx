import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import VeloriaChat from "./veloria/VeloriaChat";
import NotificationsBell from "./NotificationsBell";

const API_URL = "https://locks-promised-method-hopes.trycloudflare.com";

function authHeaders() {
  const token = localStorage.getItem("velora_token");
  return { Authorization: `Bearer ${token}` };
}

function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const userData = localStorage.getItem("velora_user");

  const user = userData
    ? JSON.parse(userData)
    : null;
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);

useEffect(() => {
  async function loadCompanyName() {
    try {
      const response = await fetch(`${API_URL}/company`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar la empresa");
      }

      const data = await response.json();

      setCompanyName(data.name || "");
    } catch (error) {
      console.error("Error cargando nombre de empresa:", error);
    }
  }
  
  loadCompanyName();
}, []);  

useEffect(() => {
  fetch("https://locks-promised-method-hopes.trycloudflare.com/company", {
    headers: { Authorization: `Bearer ${localStorage.getItem("velora_token")}` },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.enabled_modules) {
        setEnabledModules(data.enabled_modules.split(","));
      } else {
        setEnabledModules(null); // null = sin restricción (todo visible)
      }
    })
    .catch(() => setEnabledModules(null));
}, []);
  
  const PATH_TO_MODULE: Record<string, string> = {
  "/orders": "pedidos",
  "/deliveries": "entregas",
  "/pos": "pos",
  "/cash": "caja",
  "/invoices": "facturacion",
  "/accounts": "cuentas",
  "/products": "productos",
  "/customers": "clientes",
  "/stock": "stock",
  "/suppliers": "proveedores",
  "/purchases": "compras",
  "/reports": "reportes",
};
 
useEffect(() => {
  if (enabledModules === null) return; // todavía no cargó, no bloquear en falso
  const requiredModule = PATH_TO_MODULE[location.pathname];
  if (requiredModule && !enabledModules.includes(requiredModule)) {
    navigate("/dashboard", { replace: true });
  }
}, [location.pathname, enabledModules]);
  
  
function hasModule(id: string) {
  if (enabledModules === null) return true; // sistemas viejos sin restricción configurada
  return enabledModules.includes(id);
}
  function logout() {
    localStorage.removeItem("velora_token");
    localStorage.removeItem("velora_user");
    
    window.location.href = "/";
  }


  
  return (
    <div
      className={`app-layout ${
        collapsed ? "sidebar-collapsed" : ""
      }`}
    >

      {/* =========================
          SIDEBAR
      ========================= */}

      <aside className="sidebar">

        {/* BOTÓN CONTRAER / EXPANDIR */}

        <button
          className="sidebar-collapse-button"
          onClick={() => setCollapsed(!collapsed)}
          title={
            collapsed
              ? "Expandir menú"
              : "Contraer menú"
          }
          type="button"
        >
          {collapsed ? "›" : "‹"}
        </button>


        {/* MARCA */}

        <div className="sidebar-brand">

          <img src="/velora-logo.jpg" alt="Velora" style={{ width: 40, height: 40, borderRadius: 0, objectFit: "cover" }} />

          <div className="sidebar-brand-text">

            <strong>
              Velora
            </strong>

            <span>
              Gestión inteligente
            </span>

          </div>

        </div>


        {/* NAVEGACIÓN */}

      <nav className="sidebar-nav">
 
  <div className="nav-section">PRINCIPAL</div>
  <button
    className={`nav-item ${location.pathname === "/dashboard" ? "active" : ""}`}
    onClick={() => navigate("/dashboard")}
  >
    <span>⌂</span><span className="nav-item-text">Inicio</span>
  </button>
 
  <div className="nav-section">VENTAS</div>
 
  {hasModule("pedidos") && (
    <button className={`nav-item ${location.pathname === "/orders" ? "active" : ""}`} onClick={() => navigate("/orders")}>
      <span>▣</span><span className="nav-item-text">Pedidos</span>
    </button>
  )}
 
  {hasModule("entregas") && (
    <button className={`nav-item ${location.pathname === "/deliveries" ? "active" : ""}`} onClick={() => navigate("/deliveries")}>
      <span>◷</span><span className="nav-item-text">Entregas</span>
    </button>
  )}
 
  {hasModule("pos") && (
    <button className={`nav-item ${location.pathname === "/pos" ? "active" : ""}`} onClick={() => navigate("/pos")}>
      <span>🛒</span><span className="nav-item-text">Vender</span>
    </button>
  )}
 
  {hasModule("caja") && (
    <button className={`nav-item ${location.pathname === "/cash" ? "active" : ""}`} onClick={() => navigate("/cash")}>
      <span>💵</span><span className="nav-item-text">Caja</span>
    </button>
  )}
 
  <div className="nav-section">FACTURACIÓN</div>
 
  {hasModule("facturacion") && (
    <button className={`nav-item ${location.pathname === "/invoices" ? "active" : ""}`} onClick={() => navigate("/invoices")}>
      <span>🧾</span><span className="nav-item-text">Facturación</span>
    </button>
  )}
 
  {hasModule("cuentas") && (
    <button className={`nav-item ${location.pathname === "/accounts" ? "active" : ""}`} onClick={() => navigate("/accounts")}>
      <span>💳</span><span className="nav-item-text">Cuentas Corrientes</span>
    </button>
  )}
 
  <div className="nav-section">CATÁLOGO</div>
 
  {hasModule("productos") && (
    <button className={`nav-item ${location.pathname === "/products" ? "active" : ""}`} onClick={() => navigate("/products")}>
      <span>□</span><span className="nav-item-text">Productos</span>
    </button>
  )}
 
  {hasModule("clientes") && (
    <button className={`nav-item ${location.pathname === "/customers" ? "active" : ""}`} onClick={() => navigate("/customers")}>
      <span>♧</span><span className="nav-item-text">Clientes</span>
    </button>
  )}
 
  {hasModule("stock") && (
    <button className={`nav-item ${location.pathname === "/stock" ? "active" : ""}`} onClick={() => navigate("/stock")}>
      <span>◈</span><span className="nav-item-text">Stock</span>
    </button>
  )}
 
  <div className="nav-section">ABASTECIMIENTO</div>
 
  {hasModule("proveedores") && (
    <button className={`nav-item ${location.pathname === "/suppliers" ? "active" : ""}`} onClick={() => navigate("/suppliers")}>
      <span>🚚</span><span className="nav-item-text">Proveedores</span>
    </button>
  )}
 
  {hasModule("compras") && (
    <button className={`nav-item ${location.pathname === "/purchases" ? "active" : ""}`} onClick={() => navigate("/purchases")}>
      <span>📦</span><span className="nav-item-text">Compras</span>
    </button>
  )}
 
  <div className="nav-section">GESTIÓN</div>
 
  {hasModule("reportes") && (
    <button className={`nav-item ${location.pathname === "/reports" ? "active" : ""}`} onClick={() => navigate("/reports")}>
      <span>📊</span><span className="nav-item-text">Reportes</span>
    </button>
  )}
 
  <div className="nav-section">SISTEMA</div>
 
  <button className={`nav-item ${location.pathname === "/users" ? "active" : ""}`} onClick={() => navigate("/users")}>
    <span>👤</span><span className="nav-item-text">Usuarios</span>
  </button>
 
  <button className={`nav-item ${location.pathname === "/settings" ? "active" : ""}`} onClick={() => navigate("/settings")}>
    <span>⚙</span><span className="nav-item-text">Configuración</span>
  </button>
 
</nav>


        {/* FOOTER DE SIDEBAR */}

        <div className="sidebar-footer">

          <strong>
            Velora
          </strong>

          <span>
            v1.0.0 · by Mezztt
          </span>

        </div>

      </aside>


      {/* =========================
          MAIN AREA
      ========================= */}

      <div className="main-area">

        <header className="topbar">

          {/* IZQUIERDA */}

          <div className="topbar-left">

            <div className="topbar-company-wrapper">

              <span className="topbar-company">
                Empresa
              </span>

              <strong>
  {companyName || "Empresa"}
</strong>

            </div>

          </div>


          {/* DERECHA */}

          <div className="topbar-right">

            <NotificationsBell />

            <VeloriaChat />

            <div className="topbar-user">

              <div className="topbar-user-avatar">
                {user?.name?.charAt(0) || "U"}
              </div>

              <div className="topbar-user-info">
                <strong>
                  {user?.name || "Usuario"}
                </strong>

                <span>
                  {user?.email || ""}
                </span>
              </div>

            </div>

            <button
              className="topbar-logout"
              onClick={logout}
              title="Cerrar sesión"
              type="button"
            >
              ↪
            </button>

          </div>

        </header>


        {/* =========================
            WORKSPACE
        ========================= */}

        <main className="page-content">

          <div
            key={location.pathname}
            className="workspace-transition"
          >
            <Outlet />
          </div>

        </main>

      </div>

    </div>
  );
}

export default DashboardLayout;



