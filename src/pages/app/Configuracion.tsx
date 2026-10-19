import { useEffect, useState } from "react";
import { startTour } from "../../components/tour/Tour";
import type { FormEvent } from "react";
import {
  appApi, getSessionUser, splitList, money, computePrice, SPORT_LABELS, USER_KEY,
} from "../../config";
import type { ComplexSettings, Court, PriceBand } from "../../config";
import { RUBROS, RUBRO_STARTER, rubroLabel } from "../../rubros";

interface CompanyData {
  id: number; name: string; slug: string | null; email: string | null; phone: string | null;
  address: string | null; city: string | null; country: string | null; currency: string;
  sports: string | null; enabled_modules: string | null; rubro?: string | null;
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      className={`dp-switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function Configuracion() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [settings, setSettings] = useState<ComplexSettings | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // seña
  const [depEnabled, setDepEnabled] = useState(false);
  const [depPercent, setDepPercent] = useState("10");
  const [depHold, setDepHold] = useState("15");
  const [depPolicy, setDepPolicy] = useState("");
  const [token, setToken] = useState("");
  const [depMsg, setDepMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingDep, setSavingDep] = useState(false);

  // franjas
  const [bandsEnabled, setBandsEnabled] = useState(false);
  const [bands, setBands] = useState<PriceBand[]>([]);
  const [bandMsg, setBandMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingBands, setSavingBands] = useState(false);

  // turnos fijos
  const [weeks, setWeeks] = useState("8");
  const [weeksMsg, setWeeksMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveWeeks(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWeeksMsg(null);
    try {
      applySettings(await appApi<ComplexSettings>("/settings", { method: "PUT", body: { recurring_weeks_ahead: Number(weeks) } }));
      setWeeksMsg({ ok: true, text: "Guardado. Los turnos fijos se van a reservar con esa anticipación." });
    } catch (err) {
      setWeeksMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar" });
    }
  }

  function applySettings(s: ComplexSettings) {
    setSettings(s);
    setWeeks(String(s.recurring_weeks_ahead || 8));
    setDepEnabled(s.deposit_enabled);
    setDepPercent(String(s.deposit_percent));
    setDepHold(String(s.deposit_hold_minutes));
    setDepPolicy(s.deposit_policy || "");
    setBandsEnabled(s.price_bands_enabled);
    setBands(s.bands.length ? s.bands : [{ start_time: "18:00", end_time: "24:00", increase_percent: 20 }]);
  }

  useEffect(() => {
    appApi<CompanyData>("/company").then(setCompany).catch(() => {});
    appApi<ComplexSettings>("/settings").then(applySettings).catch(() => {});
    appApi<Court[]>("/courts").then(setCourts).catch(() => {});
  }, []);

  // «Cargar sugerencias»: solo crea (canchas inactivas, deportes, seña por defecto); si ya está cargado no duplica
  const [starterBusy, setStarterBusy] = useState(false);
  const [starterMsg, setStarterMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function loadStarter() {
    setStarterBusy(true);
    setStarterMsg(null);
    try {
      const r = await appApi<{ created_courts: string[]; skipped_courts: string[]; added_sports: string[] }>("/company/rubro-starter", { method: "POST" });
      const text = r.created_courts.length
        ? `Se cargaron ${r.created_courts.length} cancha${r.created_courts.length === 1 ? "" : "s"} sugerida${r.created_courts.length === 1 ? "" : "s"} (quedan inactivas hasta que les pongas precio y las actives).`
        : "Ya tenías cargadas todas las sugerencias. No se cambió nada.";
      setStarterMsg({ ok: true, text });
      appApi<Court[]>("/courts").then(setCourts).catch(() => {});
      appApi<CompanyData>("/company").then(setCompany).catch(() => {});
      appApi<ComplexSettings>("/settings").then(applySettings).catch(() => {});
    } catch (err) {
      setStarterMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudieron cargar las sugerencias" });
    } finally {
      setStarterBusy(false);
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    try {
      const updated = await appApi<CompanyData>("/company", {
        method: "PUT",
        body: {
          name: company.name, email: company.email, phone: company.phone,
          address: company.address, city: company.city, country: company.country,
          rubro: company.rubro || null,
        },
      });
      setCompany(updated);
      const u = getSessionUser();
      if (u) localStorage.setItem(USER_KEY, JSON.stringify({ ...u, company_name: updated.name }));
      alert("Datos guardados.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function saveDeposit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingDep(true);
    setDepMsg(null);
    const body: Record<string, unknown> = {
      deposit_percent: Number(depPercent),
      deposit_hold_minutes: Number(depHold),
      deposit_policy: depPolicy.trim(),
    };
    if (token.trim()) body.mp_access_token = token.trim();
    body.deposit_enabled = depEnabled;
    try {
      applySettings(await appApi<ComplexSettings>("/settings", { method: "PUT", body }));
      setToken("");
      setDepMsg({ ok: true, text: depEnabled ? "Listo: la web va a pedir seña al reservar." : "Guardado. La web no pide seña." });
    } catch (err) {
      setDepMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar" });
    } finally {
      setSavingDep(false);
    }
  }

  async function removeToken() {
    if (!confirm("¿Borrar el Access Token? La seña se desactiva.")) return;
    try {
      applySettings(await appApi<ComplexSettings>("/settings", { method: "PUT", body: { deposit_enabled: false, mp_access_token: "" } }));
      setDepMsg({ ok: true, text: "Token borrado y seña desactivada." });
    } catch (err) {
      setDepMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo borrar" });
    }
  }

  async function saveBands(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingBands(true);
    setBandMsg(null);
    try {
      applySettings(await appApi<ComplexSettings>("/settings", {
        method: "PUT",
        body: { price_bands_enabled: bandsEnabled, bands: bands.map((b) => ({ ...b, increase_percent: Number(b.increase_percent) })) },
      }));
      setBandMsg({ ok: true, text: bandsEnabled ? "Precios por horario activados. Se aplican a los turnos nuevos." : "Guardado. Todas las horas cuestan lo mismo." });
    } catch (err) {
      setBandMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar" });
    } finally {
      setSavingBands(false);
    }
  }

  function setBand(i: number, patch: Partial<PriceBand>) {
    setBands((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  if (!company) {
    return <section className="products-page"><div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div></section>;
  }

  const hasWeb = splitList(company.enabled_modules).includes("web_reservas");
  const publicUrl = `${window.location.origin}/r/${company.slug}`;
  const sample = courts[0];
  const sampleBase = sample ? computePrice(sample.price_per_hour, sample.slot_minutes) : 0;

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">CONFIGURACIÓN</span>
          <h1>Configuración</h1>
          <p>Datos del complejo, seña online y precios por horario. Las canchas se configuran en Canchas.</p>
        </div>
      </div>


      <div className="dashboard-section" style={{ marginBottom: 16 }}>
        <div className="section-heading"><h2>Recorrido por el sistema</h2><p>Volvé a ver el recorrido por el sistema.</p></div>
        <button type="button" className="secondary-button" onClick={startTour}>¿Cómo funcionamos?</button>
      </div>

      <div className="dp-grid-2">
        <div className="dashboard-section">
          <div className="section-heading"><h2>Datos del complejo</h2><p>Se muestran en la web de reservas</p></div>
          <form className="product-form" onSubmit={save}>
            <div className="form-group"><label>Nombre</label><input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Teléfono / WhatsApp</label><input value={company.phone || ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={company.email || ""} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></div>
            </div>
            <div className="form-group">
              <label>Tipo de negocio</label>
              <select value={company.rubro || ""} onChange={(e) => setCompany({ ...company, rubro: e.target.value || null })}>
                <option value="">Sin definir</option>
                {RUBROS.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
              </select>
              <small className="dp-muted">Guardá los cambios para que se aplique.</small>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Dirección</label><input value={company.address || ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></div>
              <div className="form-group"><label>Ciudad</label><input value={company.city || ""} onChange={(e) => setCompany({ ...company, city: e.target.value })} /></div>
            </div>
            <button type="submit" className="primary-button" disabled={saving} style={{ alignSelf: "flex-start" }}>{saving ? "Guardando..." : "Guardar"}</button>
          </form>
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Web de reservas</h2><p>Donde tus clientes reservan solos</p></div>
          {hasWeb && company.slug ? (
            <>
              <div className="dp-link-box">
                <code>{publicUrl}</code>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? "¡Copiado!" : "Copiar link"}
                  </button>
                  <a className="primary-button" href={publicUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Abrir</a>
                </div>
              </div>
              <p className="dp-muted" style={{ marginTop: 12 }}>
                Compartilo por WhatsApp o Instagram. Los jugadores eligen deporte, horario y cancha, y reciben un código
                que te muestran al llegar. Las reservas de la web aparecen en Turnos con la etiqueta "Web".
              </p>
            </>
          ) : (
            <p className="dp-muted">Tu plan no incluye la web de reservas. Pedile a Mezztt que la active.</p>
          )}
          <div className="section-heading" style={{ marginTop: 20 }}><h2>Deportes</h2></div>
          <p className="dp-muted">{splitList(company.sports).map((s) => SPORT_LABELS[s] || s).join(" · ") || "Se toman de las canchas que crees."}</p>
          {company.rubro && RUBRO_STARTER[company.rubro] && (
            <>
              <div className="section-heading" style={{ marginTop: 20 }}><h2>Sugerencias de tu rubro</h2></div>
              <p className="dp-muted">
                {rubroLabel(company.rubro)}: {RUBRO_STARTER[company.rubro].courts.join(", ")}. Seña sugerida: {RUBRO_STARTER[company.rubro].deposit_percent}%.
                Se agregan sin tocar lo que ya tenés: las canchas quedan inactivas y sin precio hasta que las revises.
              </p>
              <button type="button" className="secondary-button" disabled={starterBusy} onClick={loadStarter}>
                {starterBusy ? "Cargando..." : `Cargar sugerencias de ${rubroLabel(company.rubro)}`}
              </button>
              {starterMsg && <p className="dp-muted" style={{ marginTop: 8 }} role="status">{starterMsg.text}</p>}
            </>
          )}
        </div>
      </div>

      {settings && (
        <div className="dp-grid-2">
          {/* ---------------- SEÑA ---------------- */}
          <div className="dashboard-section">
            <form onSubmit={saveDeposit} className="product-form">
              <div className="dp-setting-head">
                <div>
                  <h2>Seña al reservar por la web</h2>
                  <p className="dp-muted">Si está activa, el jugador paga la seña con Mercado Pago y recién ahí se confirma la reserva.</p>
                </div>
                <Switch checked={depEnabled} onChange={setDepEnabled} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Porcentaje de seña</label>
                  <div className="dp-input-suffix"><input type="number" min="1" max="100" value={depPercent} onChange={(e) => setDepPercent(e.target.value)} /><span>%</span></div>
                </div>
                <div className="form-group">
                  <label>Tiempo para pagar</label>
                  <div className="dp-input-suffix"><input type="number" min="5" max="120" value={depHold} onChange={(e) => setDepHold(e.target.value)} /><span>min</span></div>
                  <small className="dp-muted">Si no paga en ese tiempo, la cancha se libera.</small>
                </div>
              </div>
              {sample && (
                <div className="dp-example">
                  <span>Ejemplo: turno de {sample.name} a {money(sampleBase)} → seña de <strong>{money(Math.round(sampleBase * Number(depPercent || 0) / 100))}</strong>, y en el complejo cobrás el resto.</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="dep-policy">Política de cancelación y devolución de la seña</label>
                <textarea id="dep-policy" rows={4} maxLength={600} value={depPolicy} onChange={(e) => setDepPolicy(e.target.value)}
                  placeholder={settings.deposit_policy_default || ""} />
                <small className="dp-muted">
                  El jugador la lee antes de pagar y le queda en el ticket de la reserva. Si la dejás vacía se usa el texto por defecto (el que se ve en gris).
                </small>
              </div>

              <div className="form-group">
                <label>Access Token de Mercado Pago</label>
                {settings.has_mp_token ? (
                  <div className="dp-token-row">
                    <span className="dp-pill dp-pill-green">Conectado {settings.mp_token_hint}</span>
                    {settings.mp_test_mode && <span className="dp-pill dp-pill-orange">Modo prueba</span>}
                    <button type="button" className="product-action-delete" onClick={removeToken}>Quitar</button>
                  </div>
                ) : null}
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
                  placeholder={settings.has_mp_token ? "Pegá uno nuevo para reemplazarlo" : "APP_USR-…"} autoComplete="off" />
                <small className="dp-muted">
                  Lo sacás de mercadopago.com.ar/developers → Tus integraciones → Credenciales de producción.
                  La plata de las señas va directo a esa cuenta. Para probar podés usar uno de prueba (TEST-…).
                </small>
              </div>

              {depMsg && <div className={depMsg.ok ? "dp-ok-msg" : "login-error"}>{depMsg.text}</div>}
              <button type="submit" className="primary-button" disabled={savingDep} style={{ alignSelf: "flex-start" }}>
                {savingDep ? "Guardando..." : "Guardar seña"}
              </button>
            </form>
          </div>

          {/* ---------------- PRECIOS POR HORARIO ---------------- */}
          <div className="dashboard-section">
            <form onSubmit={saveBands} className="product-form">
              <div className="dp-setting-head">
                <div>
                  <h2>Precios por horario</h2>
                  <p className="dp-muted">Apagado: todas las horas cuestan lo mismo. Encendido: cada franja suma un % al precio de la cancha.</p>
                </div>
                <Switch checked={bandsEnabled} onChange={setBandsEnabled} />
              </div>

              {!bandsEnabled && (
                <div className="dp-off-note">Desactivado: estas franjas se guardan pero no se aplican hasta que actives el switch.</div>
              )}
              <div className={`dp-bands ${bandsEnabled ? "" : "is-off"}`}>
                <div className="dp-band-row dp-band-head"><span>Desde</span><span>Hasta</span><span>Aumento</span><span /></div>
                {bands.map((b, i) => (
                  <div key={i} className="dp-band-row">
                    <input type="time" step={1800} value={b.start_time} onChange={(e) => setBand(i, { start_time: e.target.value })} required />
                    <input value={b.end_time} placeholder="24:00" pattern="^([01]?\d|2[0-4]):[0-5]\d$" onChange={(e) => setBand(i, { end_time: e.target.value })} required />
                    <div className="dp-input-suffix"><input type="number" min="-90" max="500" value={b.increase_percent} onChange={(e) => setBand(i, { increase_percent: e.target.value as unknown as number })} /><span>%</span></div>
                    <button type="button" className="dp-band-del" onClick={() => setBands(bands.filter((_, j) => j !== i))} aria-label="Quitar franja">×</button>
                  </div>
                ))}
                <button type="button" className="secondary-button" style={{ alignSelf: "flex-start" }}
                  onClick={() => setBands([...bands, { start_time: "12:00", end_time: "18:00", increase_percent: 0 }])}>
                  + Agregar franja
                </button>
              </div>

              {sample && bandsEnabled && bands.length > 0 && (
                <div className="dp-example">
                  <span>Así queda {sample.name} ({money(sample.price_per_hour)}/h):</span>
                  <div className="dp-band-preview">
                    {bands.map((b, i) => {
                      const d = new Date();
                      const [h, m] = b.start_time.split(":").map(Number);
                      d.setHours(h, m, 0, 0);
                      return <span key={i}>{b.start_time}–{b.end_time}: <strong>{money(computePrice(sample.price_per_hour, sample.slot_minutes, d, bands))}</strong></span>;
                    })}
                  </div>
                  <small className="dp-muted">Si un turno cruza dos franjas se cobra proporcional. Los turnos ya creados no cambian.</small>
                </div>
              )}

              {bandMsg && <div className={bandMsg.ok ? "dp-ok-msg" : "login-error"}>{bandMsg.text}</div>}
              <button type="submit" className="primary-button" disabled={savingBands} style={{ alignSelf: "flex-start" }}>
                {savingBands ? "Guardando..." : "Guardar precios"}
              </button>
            </form>
          </div>
        </div>
      )}

      {settings && (
        <div className="dashboard-section">
          <form onSubmit={saveWeeks} className="product-form">
            <div className="dp-setting-head">
              <div>
                <h2>Turnos fijos</h2>
                <p className="dp-muted">Los grupos que juegan todas las semanas quedan reservados con esta anticipación. Se cargan en Turnos › Turnos fijos.</p>
              </div>
            </div>
            <div className="form-group" style={{ maxWidth: 260 }}>
              <label>Reservar hacia adelante</label>
              <div className="dp-input-suffix"><input type="number" min="1" max="26" value={weeks} onChange={(e) => setWeeks(e.target.value)} /><span>semanas</span></div>
            </div>
            {weeksMsg && <div className={weeksMsg.ok ? "dp-ok-msg" : "login-error"}>{weeksMsg.text}</div>}
            <button type="submit" className="primary-button" style={{ alignSelf: "flex-start" }}>Guardar</button>
          </form>
        </div>
      )}
    </section>
  );
}

export default Configuracion;
