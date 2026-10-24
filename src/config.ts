// Configuración compartida de Deportia
// En local usa el backend de tu PC. Online se define VITE_API_URL al compilar (ver .env.example).
export const API_URL = ((typeof window !== "undefined" && (window as any).mezzttApp?.apiUrl) || import.meta.env.VITE_API_URL || "http://127.0.0.1:8020").replace(/\/$/, "");

export const APP_NAME = "Deportia";
export const APP_VERSION = "1.0.0";
export const APP_BRAND = "Mezztt";

// ---------- Marca y redes (se pueden cambiar desde Configuración del panel) ----------
export interface BrandLinks {
  system_instagram_url: string;
  mezztt_instagram_url: string;
  /** vacío = todavía no hay página: "Mezztt" enlaza a su Instagram */
  mezztt_site_url: string;
}
export const DEFAULT_BRAND_LINKS: BrandLinks = {
  system_instagram_url: "https://instagram.com/deportia.mezztt",
  mezztt_instagram_url: "https://instagram.com/mezzttofficial",
  mezztt_site_url: "https://mezztt.site",
};

/** Link público de la web de reservas de un complejo */
export function publicSiteUrl(slug: string | null | undefined): string {
  return `${window.location.origin}/r/${slug || ""}`;
}

export const ADMIN_TOKEN_KEY = "deportia_admin_token";
export const TOKEN_KEY = "deportia_token";
export const USER_KEY = "deportia_user";
export const THEME_KEY = "deportia_theme";

// ---------- Módulos ----------
// Siempre incluidos en todos los complejos (no se cobran)
export const CORE_MODULES = ["inicio", "configuracion", "usuarios"];
// Módulos base del complejo
export const BASE_MODULES = ["turnos", "canchas", "facturacion"];
// Módulos extra nuevos
export const ADDON_MODULES = ["clientes", "buffet", "torneos", "reportes"];
// Todo lo que se cobra al "precio por módulo"
export const BILLABLE_MODULES = [...BASE_MODULES, ...ADDON_MODULES];
// Web con precio propio
export const EXTRA_MODULES = ["web_reservas"];
export const WEB_MODULES = EXTRA_MODULES;
export const ALL_MODULES = [...BILLABLE_MODULES, ...EXTRA_MODULES];

export const MODULE_LABELS: Record<string, string> = {
  inicio: "Inicio",
  configuracion: "Configuración",
  usuarios: "Usuarios",
  turnos: "Turnos",
  canchas: "Canchas / Zonas",
  facturacion: "Facturación",
  clientes: "Clientes",
  buffet: "Buffet y productos",
  torneos: "Torneos y ligas",
  reportes: "Reportes",
  web_reservas: "Web de reservas",
};

export const MODULE_HINTS: Record<string, string> = {
  turnos: "Lista de reservas y turnos fijos: quién, cuántos, qué cancha y horario",
  canchas: "Vista superior de canchas, estados en vivo y check-in con código",
  facturacion: "Cobros de turnos, gastos y métodos de pago",
  clientes: "Ficha de cada cliente con historial, ausencias, deuda y avisos",
  buffet: "Bebidas, alquileres y roturas sumados al turno, venta rápida y stock",
  torneos: "Ligas, llaves y grupos: fixture automático, partido en vivo, posiciones, goleadores y link público",
  reportes: "Ocupación por día y hora, horas pico y muertas, ingresos por cancha",
  web_reservas: "Página pública para que los jugadores reserven",
};

// ---------- Precios del panel (Mezztt) ----------
export interface BillingSettings {
  setup: number | string;         // configuración: se cobra una sola vez
  base_cost?: number | string;    // nombre anterior de "setup"
  module_price: number | string;  // por módulo (inicial y mensual)
  web_price: number | string;     // web de reservas (inicial y mensual)
  // marca y redes: lo guardado (vacío = valor por defecto)
  system_instagram_url?: string;
  mezztt_instagram_url?: string;
  mezztt_site_url?: string;
}

// Planes sobre el abono mensual (mismos valores que el servidor)
export const TRIMESTRAL_MESES_PAGOS = 2;  // de 3 → 1 mes gratis
export const ANUAL_MESES_PAGOS = 10;      // de 12 → 2 meses gratis

export interface Plans { quarterly: number; annual: number; savings: number }
export function calcPlans(monthly: number | string | null | undefined): Plans {
  const m = Number(monthly || 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { quarterly: round(m * TRIMESTRAL_MESES_PAGOS), annual: round(m * ANUAL_MESES_PAGOS), savings: round(m * (12 - ANUAL_MESES_PAGOS)) };
}

export interface Pricing {
  setup: number; modulesCount: number; modulesTotal: number; webTotal: number;
  initialSubtotal: number; initialIva: number; initialTotal: number;
  monthlySubtotal: number; monthlyIva: number; monthlyTotal: number;
}

/**
 * Misma cuenta que el servidor:
 * pago inicial (una vez) = configuración + módulos + web · abono mensual = módulos + web.
 */
export function calcPricing(modules: string[], settings: BillingSettings | null, applyIva: boolean): Pricing {
  const setup = Number(settings?.setup ?? settings?.base_cost ?? 0);
  const modulesCount = modules.filter((m) => BILLABLE_MODULES.includes(m)).length;
  const modulesTotal = Number(settings?.module_price ?? 0) * modulesCount;
  const webTotal = Number(settings?.web_price ?? 0) * modules.filter((m) => WEB_MODULES.includes(m)).length;
  const round = (n: number) => Math.round(n * 100) / 100;
  const monthlySubtotal = modulesTotal + webTotal;
  const monthlyIva = applyIva ? round(monthlySubtotal * 0.21) : 0;
  const initialSubtotal = setup + monthlySubtotal;
  const initialIva = applyIva ? round(initialSubtotal * 0.21) : 0;
  return {
    setup, modulesCount, modulesTotal, webTotal,
    initialSubtotal, initialIva, initialTotal: round(initialSubtotal + initialIva),
    monthlySubtotal, monthlyIva, monthlyTotal: round(monthlySubtotal + monthlyIva),
  };
}

/** Precios del panel: siempre en dólares */
export function usd(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------- Deportes ----------
export const SPORTS = ["futbol", "padel", "tenis", "basquet", "voley", "hockey"];
export const SPORT_LABELS: Record<string, string> = {
  futbol: "Fútbol",
  padel: "Pádel",
  tenis: "Tenis",
  basquet: "Básquet",
  voley: "Vóley",
  hockey: "Hockey",
};

// ---------- Helpers ----------
export function splitList(value: string | null | undefined): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function money(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR");
}

function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** fetch para el panel general. Si el token venció, vuelve al login. */
export async function adminApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: adminHeaders(options.body !== undefined),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    if (path !== "/admin/me/password" && !path.endsWith("/toggle-active")) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "/";
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.detail || "Ocurrió un error");
  }
  return data as T;
}

/** Descarga un archivo del panel (con el token del panel). Devuelve el nombre del archivo. */
export async function adminDownload(path: string, fallbackName: string): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, { headers: adminHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as any)?.detail || "No se pudo descargar");
  }
  const match = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") || "");
  const name = match ? match[1] : fallbackName;
  const blob = await response.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return name;
}

/** Exporta una tabla a CSV (separado por ; para que Excel en español lo abra bien). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Tipos del panel ----------
export interface SystemItem {
  id: number;
  name: string;
  slug: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  sports: string | null;
  rubro?: string | null;
  enabled_modules: string | null;
  client_price: number | string | null;
  payment_status: string;
  payment_due_date: string | null;
  billed: boolean;
  apply_iva: boolean;
  archived: boolean;
  cancel_requested_at?: string | null;   // baja del servicio pedida por la empresa
  service_end_date?: string | null;       // el sistema funciona hasta esta fecha
  notes: string | null;
  created_at: string;
}

export interface PaymentItem {
  id: number;
  company_id: number;
  amount: number | string;
  payment_date: string;
  method: string | null;
  notes: string | null;
}

export const GRACE_DAYS = 10;

export function isOverdue(s: Pick<SystemItem, "payment_due_date" | "payment_status">): boolean {
  if (!s.payment_due_date || s.payment_status === "al_dia") return false;
  const limit = new Date(s.payment_due_date);
  limit.setDate(limit.getDate() + GRACE_DAYS);
  return new Date() > limit;
}

export function systemStatus(s: SystemItem): { label: string; tone: "ok" | "warn" | "off" } {
  if (s.service_end_date && !s.archived) return { label: `Baja solicitada · hasta ${s.service_end_date.slice(0, 10).split("-").reverse().join("/")}`, tone: "warn" };
  if (s.archived) return { label: "Inactivo", tone: "off" };
  if (isOverdue(s)) return { label: "Pago atrasado", tone: "warn" };
  return { label: "Activo", tone: "ok" };
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  al_dia: "Al día",
  pendiente: "Pendiente",
  vencido: "Vencido",
};

// =====================================================================
// SISTEMA DEL COMPLEJO
// =====================================================================

/** fetch para el sistema del complejo. Si la sesión venció, vuelve al login. */
export async function appApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any)?.detail || "Ocurrió un error");
  return data as T;
}

/** fetch público (web de reservas, sin login) */
export async function publicApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar. Probá de nuevo en un momento.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any)?.detail || "Ocurrió un error");
  return data as T;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  role: string;
  enabled_modules: string;
}

export function getSessionUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  ENCARGADO: "Encargado",
  RECEPCION: "Recepción",
};

// ---------- Tipos ----------
export interface Court {
  id: number;
  name: string;
  sport: string;
  description: string | null;
  players: number;
  price_per_hour: number | string;
  slot_minutes: number;
  open_time: string;
  close_time: string;
  active: boolean;
  sort_order: number;
  covered?: boolean;
  map_x?: number | null;
  map_y?: number | null;
  map_w?: number | null;
  map_h?: number | null;
}

export interface Booking {
  id: number;
  court_id: number;
  court_name: string | null;
  court_sport: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  players_count: number | null;
  start_at: string;
  end_at: string;
  price: number;
  code: string;
  status: "PENDIENTE_PAGO" | "RESERVADO" | "EN_CURSO" | "FINALIZADO" | "AUSENTE" | "CANCELADO";
  source: string;
  checked_in_at: string | null;
  finished_at: string | null;
  paid: boolean;
  paid_amount: number | null;
  payment_method: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string | null;
  deposit: { amount: number; status: "PENDIENTE" | "PAGADA" | "VENCIDA"; expires_at: string; method: string | null; paid_at: string | null } | null;
  remaining: number;
  /** turno fijo que generó esta reserva */
  recurring_id?: number | null;
  /** cliente vinculado (módulo Clientes) */
  client_id?: number | null;
  /** consumos y extras (módulo Buffet) */
  items_total?: number;
  items_unpaid?: number;
  /** todo lo que falta cobrar: cancha (menos seña) + consumos */
  total_due?: number;
}

/** Etiqueta según de dónde salió la reserva */
export const SOURCE_TAGS: Record<string, { label: string; tone: string }> = {
  WEB: { label: "Web", tone: "blue" },
  FIJO: { label: "Fijo", tone: "green" },
  TORNEO: { label: "Torneo", tone: "orange" },
};

// ---------- Turnos fijos ----------
/** 0 = lunes ... 6 = domingo (igual que el servidor) */
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Date -> día de la semana con lunes = 0 */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export interface RecurringItem {
  id: number;
  court_id: number;
  court_name: string | null;
  court_sport: string | null;
  weekday: number;
  weekday_label: string;
  start_time: string;
  duration_minutes: number;
  customer_name: string;
  customer_phone: string | null;
  players_count: number | null;
  client_id: number | null;
  price_mode: "AUTO" | "FIXED";
  fixed_price: number | null;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  state: "ACTIVO" | "PAUSADO" | "BAJA";
  notes: string | null;
  next_dates: { date: string; booking_id: number | null }[];
  conflicts: { date: string; detail: string | null }[];
  cancelled_dates: string[];
}

// ---------- Clientes ----------
export interface ClientStats {
  bookings: number; visits: number; no_shows: number; no_shows_recent: number; cancellations: number;
  upcoming: number; visits_recent: number; spent: number; debt: number; last_visit: string | null;
  usual_court: string | null; usual_sport: string | null; usual_time: string | null;
}

export interface ClientItem {
  id: number; name: string; phone: string | null; email: string | null; notes: string | null;
  blocked: boolean; created_at: string | null; stats: ClientStats; warnings: string[];
}

export interface ClientAlert {
  client: { id: number; name: string; phone: string | null; blocked: boolean } | null;
  warnings: string[];
}

// ---------- Buffet ----------
export interface BuffetProduct {
  id: number; name: string; category: string; price: number; sport: string | null;
  track_stock: boolean; stock: number; min_stock: number | null; active: boolean; low_stock: boolean;
}

export interface BookingItem {
  id: number; booking_id: number | null; product_id: number | null; description: string;
  quantity: number; unit_price: number; total: number; paid: boolean; payment_method: string | null;
  paid_at: string | null; created_at: string | null;
}

export interface PriceBand { start_time: string; end_time: string; increase_percent: number }

export interface ComplexSettings {
  deposit_enabled: boolean;
  deposit_percent: number;
  deposit_hold_minutes: number;
  has_mp_token: boolean;
  mp_token_hint: string | null;
  mp_test_mode: boolean;
  price_bands_enabled: boolean;
  bands: PriceBand[];
  /** turnos fijos: semanas que se reservan hacia adelante */
  recurring_weeks_ahead?: number;
  /** política de cancelación / devolución de la seña: lo cargado, lo que ve el cliente y el texto por defecto */
  deposit_policy?: string;
  deposit_policy_text?: string;
  deposit_policy_default?: string;
}

/** Aumento (%) en un minuto del día. Si se pisan franjas, gana la mayor (igual que el servidor). */
export function bandIncrease(bands: PriceBand[], minuteOfDay: number): number {
  let best: number | null = null;
  for (const b of bands) {
    const s = hhmmToMinutes(b.start_time) % 1440;
    const e0 = hhmmToMinutes(b.end_time);
    const e = e0 === 1440 ? 1440 : e0 % 1440;
    const inside = s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e;
    if (inside) best = best === null ? Number(b.increase_percent) : Math.max(best, Number(b.increase_percent));
  }
  return best ?? 0;
}

/** Precio de un turno con franjas horarias (proporcional minuto a minuto). */
export function computePrice(pricePerHour: number | string, minutes: number, start?: Date | null, bands?: PriceBand[] | null): number {
  const perMin = Number(pricePerHour) / 60;
  if (!bands || !bands.length || !start) return Math.round(perMin * minutes * 100) / 100;
  const base = start.getHours() * 60 + start.getMinutes();
  let total = 0;
  for (let i = 0; i < minutes; i++) total += perMin * (1 + bandIncrease(bands, (base + i) % 1440) / 100);
  return Math.round(total * 100) / 100;
}

export const BOOKING_STATUS: Record<string, { label: string; tone: string }> = {
  PENDIENTE_PAGO: { label: "Esperando seña", tone: "blue" },
  RESERVADO: { label: "Reservado", tone: "orange" },
  EN_CURSO: { label: "En curso", tone: "red" },
  FINALIZADO: { label: "Finalizado", tone: "gray" },
  AUSENTE: { label: "No se presentó", tone: "gray" },
  CANCELADO: { label: "Cancelado", tone: "gray" },
};

/**
 * color: relleno vivo para dibujos (canchas, barras, leyendas).
 * solid: fondo para etiquetas con texto blanco (contraste ≥ 4.5).
 * text:  color de texto sobre fondos claros (contraste ≥ 4.5).
 */
export const COURT_STATUS: Record<string, { label: string; color: string; solid: string; text: string }> = {
  LIBRE: { label: "Libre", color: "#22a05a", solid: "#1a7f47", text: "#146c3e" },
  RESERVADA: { label: "Reservada", color: "#e08a1e", solid: "#b3540a", text: "#9a5508" },
  OCUPADA: { label: "En uso", color: "#d64545", solid: "#c0392b", text: "#b42f2f" },
  CERRADA: { label: "Cerrada", color: "#94a3b1", solid: "#5b6b7d", text: "#4f6376" },
  PASADO: { label: "Pasado", color: "#b8c4ce", solid: "#5b6b7d", text: "#4f6376" },
};

export const PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "MERCADO_PAGO", "DEBITO", "CREDITO", "OTRO"];
export const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  OTRO: "Otro",
};

// ---------- Fechas (todo en hora local, nunca UTC) ----------
const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> "2026-10-01" */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date -> "2026-10-01T18:30:00" (hora local, lo que espera el backend) */
export function toLocalISO(d: Date): string {
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** "2026-10-01" -> Date a las 00:00 local */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000);
}

export function hhmm(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timeRange(start: string | Date, end: string | Date): string {
  return `${hhmm(start)}–${hhmm(end)}`;
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function dayLabel(d: Date, short = true): string {
  const today = new Date();
  const k = dayKey(d);
  if (k === dayKey(today)) return "Hoy";
  if (k === dayKey(addDays(today, 1))) return "Mañana";
  if (k === dayKey(addDays(today, -1))) return "Ayer";
  return short ? `${DAYS_ES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : longDate(d);
}

export function longDate(d: Date): string {
  const txt = `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function minutesLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}

/** "09:00" -> minutos; "24:00" -> 1440 */
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

/** Apertura / cierre de una cancha para un día (cierra al día siguiente si pasa la medianoche) */
export function courtWindow(court: Pick<Court, "open_time" | "close_time">, day: Date): [Date, Date] {
  const base = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const o = hhmmToMinutes(court.open_time);
  let c = hhmmToMinutes(court.close_time);
  if (c <= o) c += 1440;
  return [addMinutes(base, o), addMinutes(base, c)];
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}


// ---------- Permisos por módulo y rol ----------
const ROLE_ACCESS: Record<string, string[]> = {
  facturacion: ["ADMINISTRADOR", "ENCARGADO"],
  usuarios: ["ADMINISTRADOR"],
  configuracion: ["ADMINISTRADOR"],
  // clientes, buffet y torneos: los mismos que ven turnos (todos los roles).
  // En Torneos, Recepción opera los partidos; crear y configurar es de Administrador y Encargado.
  reportes: ["ADMINISTRADOR"],
};

/** ¿El complejo tiene habilitado este módulo? (sin mirar el rol) */
export function hasModule(user: SessionUser | null, module: string): boolean {
  return !!user && [...CORE_MODULES, ...splitList(user.enabled_modules)].includes(module);
}

export function canAccess(user: SessionUser | null, module: string): boolean {
  if (!user) return false;
  const enabled = [...CORE_MODULES, ...splitList(user.enabled_modules)];
  if (!enabled.includes(module)) return false;
  const roles = ROLE_ACCESS[module];
  return !roles || roles.includes(user.role);
}
