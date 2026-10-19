import type { TourStep } from "./Tour";
import { canAccess } from "../../config";
import type { SessionUser } from "../../config";

/** Recorrido del complejo: solo incluye lo que el menú de esta persona realmente muestra. */
export function clientSteps(user: SessionUser | null): TourStep[] {
  const has = (m: string) => canAccess(user, m);
  const steps: TourStep[] = [
    { title: "Bienvenido a Deportia", text: "Te mostramos en un minuto cómo se usa el sistema. Podés omitir el recorrido cuando quieras." },
    { selector: '[data-tour="menu"]', title: "El menú", text: "Desde acá pasás de una pantalla a otra. Solo ves lo que tu complejo tiene habilitado y lo que tu rol permite." },
    { selector: '[data-tour="inicio-acciones"]', title: "Lo más usado, en Inicio", text: "Buscá un turno por su código o cargá un turno nuevo en pocos toques." },
    { selector: '[data-tour="pendientes"]', title: "Pendientes", text: "Lo que conviene resolver hoy, con su cantidad. Tocá un renglón y vas directo a la pantalla." },
  ];
  if (has("turnos")) steps.push({ selector: '[data-tour="nav-turnos"]', title: "Turnos", text: "La lista de reservas del día: quién viene, en qué cancha y a qué hora. También los turnos fijos." });
  if (has("canchas")) steps.push({ selector: '[data-tour="nav-canchas"]', title: "Canchas", text: "Cada cancha en vivo: libre, ocupada o por terminar. Acá se hace el check-in con el código del turno." });
  if (has("facturacion")) steps.push({ selector: '[data-tour="nav-facturacion"]', title: "Facturación", text: "Cobros de turnos, gastos y métodos de pago. Es un control interno, no emite comprobantes fiscales." });
  else if (has("buffet")) steps.push({ selector: '[data-tour="nav-buffet"]', title: "Buffet", text: "Vendé bebidas y alquileres, y sumalos al turno." });
  steps.push({ selector: '[data-tour="tema"]', title: "Modo claro u oscuro", text: "Cambiá el aspecto del sistema para trabajar más cómodo." });
  steps.push(has("configuracion")
    ? { selector: '[data-tour="nav-configuracion"]', title: "Configuración", text: "Datos del complejo, seña y precios. Ahí también está el botón \"¿Cómo funcionamos?\" para volver a ver este recorrido." }
    : { selector: '[data-tour="como"]', title: "¿Cómo funcionamos?", text: "Cuando quieras volver a ver este recorrido, tocá este botón." });
  return steps;
}

export const adminSteps: TourStep[] = [
  { title: "Panel general de Deportia", text: "Desde acá administrás los complejos que usan el sistema, sus pagos y la facturación. Te hacemos un recorrido corto." },
  { selector: '[data-tour="menu"]', title: "El menú", text: "Inicio, Complejos, Pagos, Facturación y Configuración." },
  { selector: '[data-tour="nav-complejos"]', title: "Complejos", text: "Alta de cada complejo, módulos habilitados, abono sugerido, usuarios y estado del servicio." },
  { selector: '[data-tour="nav-pagos"]', title: "Pagos", text: "Registrá lo que cobrás a cada complejo y controlá los vencimientos." },
  { selector: '[data-tour="nav-facturacion"]', title: "Facturación", text: "Cotizaciones con pago inicial y abono mensual (más los planes trimestral y anual), y los resúmenes mensuales." },
  { selector: '[data-tour="tema"]', title: "Modo claro u oscuro", text: "Cambiá el aspecto del panel cuando quieras." },
  { selector: '[data-tour="nav-configuracion"]', title: "Configuración", text: "Precios, marca y redes, y la copia de seguridad. Ahí también está el botón \"¿Cómo funcionamos?\" para repetir este recorrido." },
];
