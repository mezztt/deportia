import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { THEME_KEY } from "./config";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Panel general (Mezztt)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import Complejos from "./pages/admin/Complejos";
import Pagos from "./pages/admin/Pagos";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSettings from "./pages/admin/AdminSettings";
import MailCenter from "./pages/admin/MailCenter";

// Sistema del complejo
import ClientLayout from "./pages/app/ClientLayout";
import ClientHome from "./pages/app/ClientHome";
import Turnos from "./pages/app/Turnos";
import Canchas from "./pages/app/Canchas";
import Facturacion from "./pages/app/Facturacion";
import Usuarios from "./pages/app/Usuarios";
import Configuracion from "./pages/app/Configuracion";
import Clientes from "./pages/app/Clientes";
import Buffet from "./pages/app/Buffet";
import Torneos from "./pages/app/Torneos";
import Reportes from "./pages/app/Reportes";

// Web pública de reservas (jugadores)
import Reservar from "./pages/public/Reservar";
import Ticket from "./pages/public/Ticket";
import TorneoPublico from "./pages/public/TorneoPublico";
import Legal from "./pages/public/Legal";

function App() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    // las páginas públicas se ven siempre en claro (lo fuerza useLightPage)
    if (/^\/(r|legal)\//.test(window.location.pathname) && !/\/torneo\//.test(window.location.pathname)) return;
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* PANEL GENERAL (Mezztt) */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/complejos" element={<Complejos />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/facturacion" element={<AdminBilling />} />
          <Route path="/admin/correos" element={<MailCenter />} />
          <Route path="/admin/configuracion" element={<AdminSettings />} />
        </Route>

        {/* SISTEMA DEL COMPLEJO */}
        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/app" element={<ClientHome />} />
          <Route path="/app/turnos" element={<Turnos />} />
          <Route path="/app/canchas" element={<Canchas />} />
          <Route path="/app/clientes" element={<Clientes />} />
          <Route path="/app/buffet" element={<Buffet />} />
          <Route path="/app/torneos" element={<Torneos />} />
          <Route path="/app/facturacion" element={<Facturacion />} />
          <Route path="/app/reportes" element={<Reportes />} />
          <Route path="/app/usuarios" element={<Usuarios />} />
          <Route path="/app/configuracion" element={<Configuracion />} />
        </Route>

        {/* WEB DE RESERVAS (pública, sin login) */}
        <Route path="/r/:slug" element={<Reservar />} />
        <Route path="/r/:slug/turno/:code" element={<Ticket />} />
        <Route path="/r/:slug/torneo/:id" element={<TorneoPublico />} />

        {/* LEGALES (públicas, sin login) */}
        <Route path="/legal/terminos" element={<Legal doc="terminos" />} />
        <Route path="/legal/privacidad" element={<Legal doc="privacidad" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
