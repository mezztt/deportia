import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { publicApi, money, timeRange, longDate, SPORT_LABELS } from "../../config";
import CourtIcon from "../../components/CourtIcon";
import { PoweredBy, useLightPage } from "../../components/Brand";
import ConsumerRights from "../../components/ConsumerRights";

interface TicketData {
  code: string;
  status: string;
  customer_name: string;
  players_count: number | null;
  start_at: string;
  end_at: string;
  price: number;
  paid: boolean;
  court: { name: string; sport: string } | null;
  deposit: { amount: number; status: string; expires_at: string; payment_url: string | null; policy?: string | null } | null;
  remaining: number;
  complex: { name: string; slug: string; address: string | null; city: string | null; phone: string | null };
}

const STATUS_TEXT: Record<string, { label: string; color: string; hint: string }> = {
  PENDIENTE_PAGO: { label: "Falta pagar la seña", color: "#2a5f8f", hint: "Tu reserva se confirma cuando se acredita la seña." },
  RESERVADO: { label: "Reserva confirmada", color: "#1a7f47", hint: "Mostrale este código al encargado cuando llegues." },
  EN_CURSO: { label: "¡A jugar!", color: "#c0392b", hint: "Tu turno está en curso." },
  FINALIZADO: { label: "Turno terminado", color: "#4f6376", hint: "¡Gracias por venir!" },
  AUSENTE: { label: "No te presentaste", color: "#4f6376", hint: "El turno venció sin registrarse tu llegada." },
  CANCELADO: { label: "Reserva cancelada", color: "#4f6376", hint: "Si fue un error, comunicate con el complejo." },
};

function Ticket() {
  useLightPage();
  const { slug = "", code = "" } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<TicketData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [, setTick] = useState(0);

  async function load() {
    try {
      setT(await publicApi<TicketData>(`/public/complexes/${slug}/bookings/${code}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No encontramos la reserva");
    }
  }

  async function verify(paymentId?: string | null) {
    setVerifying(true);
    setPayMsg("");
    try {
      const qs = paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : "";
      const data = await publicApi<TicketData>(`/public/complexes/${slug}/bookings/${code}/verify-payment${qs}`, { method: "POST" });
      setT(data);
      if (data.status === "PENDIENTE_PAGO") setPayMsg("Todavía no vemos el pago acreditado. Si recién pagaste, esperá unos segundos y probá de nuevo.");
    } catch (e) {
      setPayMsg(e instanceof Error ? e.message : "No se pudo verificar el pago");
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    // volviendo de Mercado Pago: ?payment_id=...&status=approved|rejected|pending
    const q = new URLSearchParams(window.location.search);
    const paymentId = q.get("payment_id") || q.get("collection_id");
    const mpStatus = q.get("status") || q.get("collection_status");
    if (paymentId || mpStatus) {
      window.history.replaceState(null, "", window.location.pathname);
      if (mpStatus === "rejected" || mpStatus === "null" || mpStatus === "failure") {
        setPayMsg("El pago no se aprobó. Podés intentarlo de nuevo.");
        load();
      } else {
        verify(paymentId);
      }
    } else {
      load();
    }
    const tick = setInterval(() => setTick((x) => x + 1), 15000);
    const i = setInterval(load, 30000);
    return () => { clearInterval(i); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, code]);

  if (error) {
    return (
      <main className="pub-page"><div className="pub-empty"><h1>Reserva no encontrada</h1><p>{error}</p>
        <button className="pub-cta" onClick={() => navigate(`/r/${slug}`)}>Ir a reservar</button></div></main>
    );
  }
  if (!t) return <main className="pub-page"><div className="pub-empty"><div className="products-loading-spinner" /></div></main>;

  let st = STATUS_TEXT[t.status] || STATUS_TEXT.RESERVADO;
  if (t.status === "CANCELADO" && t.deposit?.status === "VENCIDA") {
    st = { label: "La reserva venció", color: "#4f6376", hint: "No se pagó la seña a tiempo y la cancha se liberó. Podés reservar de nuevo." };
  }
  const pending = t.status === "PENDIENTE_PAGO" && t.deposit;
  const minutesLeft = pending ? Math.max(0, Math.ceil((new Date(t.deposit!.expires_at).getTime() - Date.now()) / 60000)) : 0;
  const start = new Date(t.start_at);
  const phoneDigits = (t.complex.phone || "").replace(/\D/g, "");
  const shareText = `Reservé ${t.court?.name} en ${t.complex.name} · ${longDate(start)} ${timeRange(t.start_at, t.end_at)} · Código ${t.code}`;

  async function share() {
    const url = window.location.href;
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: "Mi reserva", text: shareText, url });
      else {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* cancelado */ }
  }

  return (
    <main className="pub-page pub-ticket-page">
      <ConsumerRights slug={t.complex.slug} bookingCode={t.code} complexPhone={t.complex.phone} />
      <div className="pub-ticket">
        <div className="pub-ticket-top" style={{ background: st.color }}>
          <small>{t.complex.name}</small>
          <h1>{st.label}</h1>
        </div>

        {pending && (
          <div className="pub-pay-box">
            <span>Seña a pagar</span>
            <strong>{money(t.deposit!.amount)}</strong>
            <small>{minutesLeft > 0 ? `Te quedan ${minutesLeft} min para pagarla` : "Se está por vencer"}</small>
            {t.deposit!.payment_url && <a className="pub-cta pub-cta-mp" href={t.deposit!.payment_url}>Pagar con Mercado Pago</a>}
            <button className="pub-link" onClick={() => verify()} disabled={verifying}>{verifying ? "Verificando..." : "Ya pagué, verificar"}</button>
            {payMsg && <p className="pub-pay-msg">{payMsg}</p>}
          </div>
        )}
        {!pending && payMsg && <p className="pub-pay-msg" style={{ margin: "16px 22px 0" }}>{payMsg}</p>}

        <div className={`pub-ticket-code ${pending ? "is-dim" : ""}`}>
          <small>Tu código</small>
          <div className="pub-code">{t.code.split("").map((ch, i) => <span key={i}>{ch}</span>)}</div>
          <p>{st.hint}</p>
        </div>

        <div className="pub-ticket-cut" />

        <div className="pub-ticket-body">
          {t.court && <CourtIcon sport={t.court.sport} width={120} />}
          <div className="pub-ticket-rows">
            <div><small>Cancha</small><strong>{t.court?.name} · {SPORT_LABELS[t.court?.sport || ""]}</strong></div>
            <div><small>Día</small><strong>{longDate(start)}</strong></div>
            <div><small>Horario</small><strong>{timeRange(t.start_at, t.end_at)} hs</strong></div>
            <div><small>A nombre de</small><strong>{t.customer_name}{t.players_count ? ` · ${t.players_count} personas` : ""}</strong></div>
            <div>
              <small>Total</small>
              <strong>
                {money(t.price)}{" "}
                {t.paid ? "· pagado ✓"
                  : t.deposit?.status === "PAGADA" ? `· seña ${money(t.deposit.amount)} pagada ✓ · resta ${money(t.remaining)} en el complejo`
                  : pending ? `· seña ${money(t.deposit!.amount)} + ${money(t.remaining - t.deposit!.amount)} en el complejo`
                  : "· se paga en el complejo"}
              </strong>
            </div>
            {(t.complex.address || t.complex.city) && (
              <div><small>Dirección</small><strong>{[t.complex.address, t.complex.city].filter(Boolean).join(", ")}</strong></div>
            )}
          </div>
        </div>

        {t.deposit?.policy && (
          <div className="pub-policy pub-policy-ticket">
            <strong>Cancelación y devolución de la seña</strong>
            <p>{t.deposit.policy}</p>
          </div>
        )}
        <p className="pub-ticket-legal">Comprobante de reserva · Documento no válido como factura</p>

        <div className="pub-ticket-actions">
          <button className="pub-cta" onClick={share}>{copied ? "¡Copiado!" : "Compartir / guardar"}</button>
          {phoneDigits && (
            <a className="pub-cta pub-cta-outline" href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hola! Tengo la reserva ${t.code}`)}`} target="_blank" rel="noreferrer">
              Escribir al complejo
            </a>
          )}
          <button className="pub-link" onClick={() => navigate(`/r/${slug}`)}>Reservar otro turno</button>
        </div>
      </div>
      <footer className="pub-footer"><PoweredBy /></footer>
    </main>
  );
}

export default Ticket;
