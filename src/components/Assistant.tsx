import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, money, timeRange, dayKey, addDays, BOOKING_STATUS, PAYMENT_LABELS } from "../config";
import type { Booking, SessionUser } from "../config";
import { DeportiaLogo } from "./Brand";

/**
 * Asistente de Deportia.
 * Responde con datos reales del complejo (canchas libres, turnos, cobros, códigos)
 * y explica cómo usar el sistema. No usa IA externa: no tiene costo y funciona online.
 */

interface Msg {
  from: "bot" | "user";
  text: string;
  actions?: { label: string; to: string }[];
}

interface Overview {
  in_progress: number; waiting: number; today_count: number; occupancy: number;
  income_today: number; income_month: number; pending_count: number; pending_total: number;
  courts: { id: number; name: string; status: string; booking: Booking | null }[];
  upcoming: Booking[];
}

const SUGGESTIONS = [
  "¿Qué canchas están libres?",
  "Turnos de hoy",
  "¿Quién sigue?",
  "¿Cuánto cobré hoy?",
  "Turnos sin cobrar",
  "¿Cómo confirmo un código?",
];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

const HELP: { keys: string[]; text: string; to?: string; label?: string }[] = [
  {
    keys: ["dar de baja el servicio", "dar de baja el sistema", "baja del servicio", "baja del sistema", "darme de baja", "cancelar el servicio", "cancelar mi cuenta", "dejar de usar el sistema", "retirar la baja", "constancia de baja"],
    text: "Para dar de baja el servicio entrá a Configuración y tocá «Dar de baja el servicio» (también está al pie de la pantalla de ingreso). Lo hace el administrador, sin motivo y en dos pasos, y te da una constancia BAJA-AAAA-NNNN con fecha y hora para copiar o imprimir. El sistema NO se corta ese día: sigue funcionando hasta el final del período que ya pagaste, y antes de esa fecha podés «Retirar la baja». Después se desactiva y tus datos se conservan.",
    to: "/app/configuracion", label: "Ir a Configuración",
  },
  {
    keys: ["codigo", "check", "llegada", "llego", "llegaron", "confirmar"],
    text: "Para confirmar que llegaron: abrí el turno (desde Canchas o Turnos, o buscando el código arriba), pedile el código al jugador y fijate que coincida con el que ves. Tocá «Confirmar llegada» y la cancha pasa a rojo (en uso). Se puede confirmar desde 30 min antes.",
    to: "/app/canchas", label: "Ir a Canchas",
  },
  {
    keys: ["cobrar", "pago", "pagar", "metodo"],
    text: "Para cobrar: abrí el turno y tocá «$ Pago». Te muestra el total (o el saldo si dejaron seña), elegís el método (efectivo, transferencia, Mercado Pago, débito, crédito) y queda registrado en Facturación.",
  },
  {
    keys: ["sena", "mercado pago", "mercadopago", "anticipo"],
    text: "La seña se activa en Configuración → «Seña al reservar por la web». Elegís el % (ej. 10%), cuántos minutos tiene el jugador para pagar y cargás el Access Token de Mercado Pago del complejo. Cuando se acredita, la reserva se confirma sola y la seña entra en Facturación.",
    to: "/app/configuracion", label: "Ir a Configuración",
  },
  {
    keys: ["precio por horario", "franja", "noche", "mas caro", "aumento", "precios"],
    text: "En Configuración → «Precios por horario» activás las franjas: desde, hasta y % de aumento (ej. 18:00 a 24:00 +20%). También acepta descuentos (ej. −10% a la mañana). Si un turno cruza dos franjas se cobra proporcional.",
    to: "/app/configuracion", label: "Ir a Configuración",
  },
  {
    keys: ["crear cancha", "nueva cancha", "agregar cancha", "cargar cancha", "editar cancha"],
    text: "En Canchas tocá «+ Nueva cancha»: elegís deporte, precio por hora, duración del turno y horario de apertura y cierre. Para editar una, tocá el engranaje ⚙ arriba de la cancha.",
    to: "/app/canchas", label: "Ir a Canchas",
  },
  {
    keys: ["reservar", "nuevo turno", "cargar turno", "anotar"],
    text: "Para reservar: en Canchas tocá un horario verde de la cancha, o usá «+ Nuevo turno» en Turnos. Cargás a nombre de quién, teléfono y cuántas personas; el precio se calcula solo.",
    to: "/app/turnos", label: "Ir a Turnos",
  },
  {
    keys: ["cancelar"],
    text: "Abrí el turno y tocá «Cancelar turno». La cancha queda libre al instante.",
  },
  {
    keys: ["web", "link", "pagina de reservas", "compartir", "clientes reserven"],
    text: "Tu web de reservas está en Configuración → «Web de reservas». Copiá el link y compartilo por WhatsApp o Instagram: los jugadores eligen deporte, día, horario y cancha, y reciben un código.",
    to: "/app/configuracion", label: "Ver el link",
  },
  {
    keys: ["usuario", "empleado", "rol", "permiso", "recepcion", "encargado"],
    text: "En Usuarios creás a tu equipo. Roles: Administrador (todo), Encargado (canchas, turnos y facturación) y Recepción (turnos y canchas, sin ver la plata).",
    to: "/app/usuarios", label: "Ir a Usuarios",
  },
  {
    keys: ["notificacion", "aviso", "campana", "termina"],
    text: "Cuando termina un turno te llega un aviso con sonido y queda en la campanita de arriba a la derecha. También avisa si alguien no se presentó y cuando entra una reserva de la web.",
  },
  {
    keys: ["gasto", "egreso", "luz", "sueldo"],
    text: "Los gastos se cargan en Facturación → «− Cargar gasto». Elegís categoría (luz, sueldos, mantenimiento…), monto y método. Así ves el balance real del mes.",
    to: "/app/facturacion", label: "Ir a Facturación",
  },
  {
    keys: ["oscuro", "tema", "claro"],
    text: "El modo oscuro se cambia abajo del menú de la izquierda, en «☾ Modo oscuro».",
  },
];

function Assistant({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // en el celular el botón se esconde al bajar la pantalla (así no tapa los botones de acción del final) y vuelve al subir
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const y = t instanceof Document ? window.scrollY : (t as HTMLElement).scrollTop;
      const prev = last.get(t);
      if (prev === undefined) { last.set(t, y); return; }
      if (Math.abs(y - prev) > 6) { setTuck(y > prev && y > 60); last.set(t, y); }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seeMoney = canAccess(user, "facturacion");

  useEffect(() => {
    if (open && msgs.length === 0) {
      const first = (user?.name || "").split(" ")[0];
      setMsgs([{
        from: "bot",
        text: `¡Hola${first ? ` ${first}` : ""}! Soy el asistente de Deportia. Te digo qué canchas están libres, quién sigue, cuánto se cobró, busco un código o te explico cómo hacer algo.`,
      }]);
    }
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  async function answer(raw: string): Promise<Msg> {
    const t = norm(raw);

    // ---- código de turno (6 caracteres) ----
    const codeMatch = raw.toUpperCase().match(/\b[A-HJ-NP-Z2-9]{6}\b/);
    if (codeMatch && (has(t, "codigo", "busca") || (raw.trim().length <= 8 && /\d/.test(codeMatch[0])))) {
      try {
        const b = await appApi<Booking>(`/bookings/by-code/${codeMatch[0]}`);
        const st = BOOKING_STATUS[b.status]?.label || b.status;
        return {
          from: "bot",
          text: `Código ${b.code}: ${b.customer_name} · ${b.court_name} · ${new Date(b.start_at).toLocaleDateString("es-AR")} ${timeRange(b.start_at, b.end_at)}.\nEstado: ${st}. ${b.paid ? `Pagado (${PAYMENT_LABELS[b.payment_method || ""] || "ok"}).` : `Falta cobrar ${money(b.remaining ?? b.price)}.`}`,
          actions: [{ label: "Ver en Canchas", to: `/app/canchas?court=${b.court_id}` }],
        };
      } catch {
        return { from: "bot", text: `No encontré ningún turno con el código ${codeMatch[0]}. Revisá que esté bien escrito.` };
      }
    }

    // ---- saludo / gracias ----
    if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey)\b/.test(t)) {
      return { from: "bot", text: "¡Hola! ¿En qué te ayudo? Podés tocar una de las sugerencias de abajo." };
    }
    if (has(t, "gracias", "genial", "joya", "perfecto")) {
      return { from: "bot", text: "¡De nada! Cualquier cosa, acá estoy. ⚽" };
    }

    // ---- ayuda de uso (cómo...) ----
    if (has(t, "como", "donde", "que hago", "ayuda", "se puede")) {
      const h = HELP.find((x) => x.keys.some((k) => t.includes(k)));
      if (h) return { from: "bot", text: h.text, actions: h.to ? [{ label: h.label || "Ir", to: h.to }] : undefined };
    }

    // ---- canchas libres / estado ----
    if (has(t, "libre", "disponible", "ocupad", "en uso", "estado de las canchas", "canchas")) {
      const d = await appApi<Overview>("/dashboard");
      if (!d.courts.length) return { from: "bot", text: "Todavía no hay canchas cargadas.", actions: [{ label: "Crear canchas", to: "/app/canchas" }] };
      const by = (s: string) => d.courts.filter((c) => c.status === s);
      const libres = by("LIBRE"), uso = by("OCUPADA"), res = by("RESERVADA"), cerr = by("CERRADA");
      const lines = [
        libres.length ? `🟢 Libres (${libres.length}): ${libres.map((c) => c.name).join(", ")}` : "🟢 No hay canchas libres ahora.",
        uso.length ? `🔴 En uso: ${uso.map((c) => `${c.name} (${c.booking?.customer_name}, hasta ${timeRange(c.booking!.start_at, c.booking!.end_at).slice(-5)})`).join(", ")}` : "",
        res.length ? `🟠 Reservadas esperando llegada: ${res.map((c) => `${c.name} (${c.booking?.customer_name})`).join(", ")}` : "",
        cerr.length ? `⚪ Cerradas a esta hora: ${cerr.map((c) => c.name).join(", ")}` : "",
      ].filter(Boolean);
      return { from: "bot", text: lines.join("\n"), actions: [{ label: "Ver canchas", to: "/app/canchas" }] };
    }

    // ---- quién sigue ----
    if (has(t, "sigue", "proximo", "siguiente", "quien viene", "despues")) {
      const d = await appApi<Overview>("/dashboard");
      const next = d.upcoming.filter((b) => b.status === "RESERVADO" || b.status === "PENDIENTE_PAGO");
      if (!next.length) return { from: "bot", text: "No quedan turnos por llegar hoy." };
      return {
        from: "bot",
        text: "Próximos turnos de hoy:\n" + next.slice(0, 5).map((b) => `• ${timeRange(b.start_at, b.end_at)} · ${b.court_name} · ${b.customer_name}${b.players_count ? ` (${b.players_count})` : ""}`).join("\n"),
        actions: [{ label: "Ver turnos", to: "/app/turnos" }],
      };
    }

    // ---- turnos de hoy / mañana ----
    if (has(t, "turno", "agenda", "reserva", "hoy", "manana")) {
      const tomorrow = t.includes("manana");
      const day = dayKey(tomorrow ? addDays(new Date(), 1) : new Date());
      const list = (await appApi<Booking[]>(`/bookings?date=${day}`)).filter((b) => b.status !== "CANCELADO");
      if (!list.length) return { from: "bot", text: `No hay turnos para ${tomorrow ? "mañana" : "hoy"}.`, actions: [{ label: "Cargar un turno", to: "/app/turnos" }] };
      const people = list.reduce((s, b) => s + (b.players_count || 0), 0);
      return {
        from: "bot",
        text: `${tomorrow ? "Mañana" : "Hoy"} hay ${list.length} turno${list.length > 1 ? "s" : ""}${people ? ` (${people} personas)` : ""}:\n` +
          list.slice(0, 8).map((b) => `• ${timeRange(b.start_at, b.end_at)} · ${b.court_name} · ${b.customer_name} — ${BOOKING_STATUS[b.status]?.label}`).join("\n") +
          (list.length > 8 ? `\n… y ${list.length - 8} más.` : ""),
        actions: [{ label: "Ver turnos", to: "/app/turnos" }],
      };
    }

    // ---- plata ----
    if (has(t, "sin cobrar", "deben", "debe", "pendiente", "falta cobrar")) {
      const d = await appApi<Overview>("/dashboard");
      if (!d.pending_count) return { from: "bot", text: "No hay turnos jugados sin cobrar. 🎉" };
      return {
        from: "bot",
        text: `Hay ${d.pending_count} turno${d.pending_count > 1 ? "s" : ""} jugado${d.pending_count > 1 ? "s" : ""} sin cobrar, por ${money(d.pending_total)} en total.`,
        actions: seeMoney ? [{ label: "Ver y cobrar", to: "/app/facturacion" }] : undefined,
      };
    }
    if (has(t, "cobr", "caja", "ingres", "plata", "factur", "gane", "recaud", "vendi")) {
      if (!seeMoney) return { from: "bot", text: "Tu usuario no tiene acceso a la facturación. Pedíselo al administrador del complejo." };
      const d = await appApi<Overview>("/dashboard");
      return {
        from: "bot",
        text: `Hoy se cobraron ${money(d.income_today)} y en el mes ${money(d.income_month)}.${d.pending_count ? `\nFalta cobrar ${money(d.pending_total)} de ${d.pending_count} turno(s) ya jugado(s).` : ""}`,
        actions: [{ label: "Ver Facturación", to: "/app/facturacion" }],
      };
    }
    if (has(t, "ocupacion", "lleno", "movimiento")) {
      const d = await appApi<Overview>("/dashboard");
      return { from: "bot", text: `La ocupación de hoy va en ${d.occupancy}% (${d.today_count} turnos, ${d.in_progress} jugando ahora).` };
    }

    // ---- ayuda sin "cómo" ----
    const h = HELP.find((x) => x.keys.some((k) => t.includes(k)));
    if (h) return { from: "bot", text: h.text, actions: h.to ? [{ label: h.label || "Ir", to: h.to }] : undefined };

    return {
      from: "bot",
      text: "No te entendí del todo 😅. Probá con algo como «¿qué canchas están libres?», «turnos de mañana», «¿cuánto cobré hoy?», un código de turno, o «¿cómo activo la seña?».",
    };
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 450))]);
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "bot", text: e instanceof Error ? `Uy, no pude consultar eso: ${e.message}` : "Uy, algo falló." }]);
    } finally {
      setTyping(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {!open && (
        <button className={`dp-assist-fab ${tuck ? "is-tucked" : ""}`} onClick={() => setOpen(true)} aria-label="Abrir asistente">
          <span className="dp-assist-fab-icon">💬</span>
          <span className="dp-assist-fab-text">Asistente</span>
        </button>
      )}
      {open && (
        <div className="dp-assist">
          <div className="dp-assist-head">
            <DeportiaLogo size={34} />
            <div>
              <strong>Asistente Deportia</strong>
              <small>Turnos, canchas y cobros al instante</small>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          </div>
          <div className="dp-assist-body">
            {msgs.map((m, i) => (
              <div key={i} className={`dp-assist-msg ${m.from}`}>
                <p>{m.text}</p>
                {m.actions && (
                  <div className="dp-assist-actions">
                    {m.actions.map((a) => (
                      <button key={a.to + a.label} onClick={() => { navigate(a.to); }}>{a.label} ›</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="dp-assist-msg bot"><p className="dp-assist-typing"><span /><span /><span /></p></div>}
            <div ref={endRef} />
          </div>
          <div className="dp-assist-suggest">
            {SUGGESTIONS.filter((s) => seeMoney || !s.includes("cobr")).map((s) => (
              <button key={s} onClick={() => send(s)} disabled={typing}>{s}</button>
            ))}
          </div>
          <form className="dp-assist-input" onSubmit={submit}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu pregunta o un código…" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar">➤</button>
          </form>
        </div>
      )}
    </>
  );
}

export default Assistant;
