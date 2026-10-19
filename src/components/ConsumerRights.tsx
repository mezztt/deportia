import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { publicApi } from "../config";

/**
 * BOTÓN DE ARREPENTIMIENTO y BOTÓN DE BAJA DE SERVICIO (Disposición 954/2025).
 * Van a simple vista en las pantallas públicas donde se contrata (reservas y ticket).
 * Sin registro previo: nombre + contacto. Al enviar se muestra el código de registración.
 */
type Kind = "ARREPENTIMIENTO" | "BAJA";
interface Done { code: string; detail: string }

const TEXT: Record<Kind, { button: string; title: string; lead: string }> = {
  ARREPENTIMIENTO: {
    button: "BOTÓN DE ARREPENTIMIENTO", title: "Botón de arrepentimiento",
    lead: "Si te arrepentís de una reserva, avisanos acá. No hace falta registrarte. Hay casos en que no corresponde, por ejemplo si el turno ya se usó.",
  },
  BAJA: {
    button: "BOTÓN DE BAJA DE SERVICIO", title: "Botón de baja de servicio",
    lead: "Para dar de baja un servicio contratado (por ejemplo, un turno fijo), avisanos acá. No hace falta registrarte.",
  },
};

export default function ConsumerRights({ slug, bookingCode = "", complexPhone = null }: { slug: string; bookingCode?: string; complexPhone?: string | null }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", booking: bookingCode, message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setKind(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind]);

  function open(k: Kind) { setKind(k); setDone(null); setError(""); setForm((f) => ({ ...f, booking: bookingCode || f.booking })); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError("");
    try {
      const r = await publicApi<Done>(`/public/complexes/${slug}/consumer-request`, {
        method: "POST",
        body: { kind, name: form.name, contact: form.contact, booking_code: form.booking || null, message: form.message || null },
      });
      setDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dp-rights" aria-label="Arrepentimiento y baja">
      <button type="button" className="dp-rights-btn" onClick={() => open("ARREPENTIMIENTO")}>{TEXT.ARREPENTIMIENTO.button}</button>
      <button type="button" className="dp-rights-btn" onClick={() => open("BAJA")}>{TEXT.BAJA.button}</button>
      {kind && (
        <div className="dp-rights-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setKind(null); }}>
          <div className="dp-rights-modal" role="dialog" aria-modal="true" aria-labelledby="dp-rights-title">
            <div className="dp-rights-head">
              <h2 id="dp-rights-title">{TEXT[kind].title}</h2>
              <button type="button" className="dp-rights-close" aria-label="Cerrar" onClick={() => setKind(null)}>×</button>
            </div>
            {done ? (
              <div className="dp-rights-done">
                <p>{done.detail}</p>
                <p className="dp-rights-code" aria-label="Código de registración">{done.code}</p>
                <small>Es la constancia de tu pedido: sacale una captura o anotalo.{complexPhone ? ` Consultas: ${complexPhone}.` : ""}</small>
                <button type="button" className="pub-cta" onClick={() => setKind(null)}>Listo</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p>{TEXT[kind].lead}</p>
                <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={150} autoComplete="name" /></label>
                <label>Teléfono o email para responderte<input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required minLength={6} maxLength={150} autoComplete="tel" /></label>
                <label>Código de reserva (opcional)<input value={form.booking} onChange={(e) => setForm({ ...form, booking: e.target.value.toUpperCase() })} maxLength={20} /></label>
                <label>Comentario (opcional)<textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={500} /></label>
                {error && <p className="dp-rights-error" role="alert">{error}</p>}
                <button type="submit" className="pub-cta" disabled={busy}>{busy ? "Enviando..." : "Enviar pedido"}</button>
                <small>Te damos un código de registración al instante. Podemos pedirte datos razonables para verificar que sos vos.</small>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
