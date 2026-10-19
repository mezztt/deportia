import { useEffect, useState } from "react";
import { appApi, money, dayKey, addDays, downloadCsv } from "../../config";

interface Cell { weekday: number; hour: number; pct: number; booked_hours: number; available_hours: number }
interface Slot extends Cell { label: string; suggestion: string }
interface Report {
  from: string; to: string; days: number; weekdays: string[]; hours: number[]; heatmap: Cell[];
  occupancy_pct: number; booked_hours: number; available_hours: number;
  peaks: Slot[]; dead: Slot[];
  by_court: { court_id: number; name: string; sport: string; active: boolean; available_hours: number; booked_hours: number; pct: number; bookings: number; income: number }[];
  by_sport: { sport: string; label: string; available_hours: number; booked_hours: number; pct: number; bookings: number; income: number }[];
  by_weekday: { weekday: number; label: string; bookings: number; income: number }[];
  by_source: { source: string; label: string; bookings: number; income: number }[];
  bookings_total: number; no_shows: number; cancellations: number; no_show_rate: number; cancellation_rate: number;
  income_total: number; paid_bookings: number; average_ticket: number;
  buffet: null | { total: number; count: number; counter_total: number; booking_total: number; ranking: { description: string; quantity: number; total: number }[] };
}

type Period = "30" | "90" | "mes" | "custom";

/** Escala de un solo color (verde): más oscuro = más ocupado. 5 pasos con texto legible en cada uno. */
function heatLevel(pct: number): number {
  if (pct <= 0) return 0;
  if (pct < 25) return 1;
  if (pct < 50) return 2;
  if (pct < 75) return 3;
  return 4;
}

function HBar({ label, value, pct, title }: { label: string; value: string; pct: number; title?: string }) {
  return (
    <li title={title}>
      <div className="dp-hbar-label"><span>{label}</span><strong>{value}</strong></div>
      <div className="dp-hbar-track"><div className="dp-hbar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
    </li>
  );
}

function Reportes() {
  const today = new Date();
  const [period, setPeriod] = useState<Period>("30");
  const [customFrom, setCustomFrom] = useState(dayKey(addDays(today, -29)));
  const [customTo, setCustomTo] = useState(dayKey(today));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const from = period === "30" ? dayKey(addDays(today, -29))
    : period === "90" ? dayKey(addDays(today, -89))
    : period === "mes" ? dayKey(new Date(today.getFullYear(), today.getMonth(), 1))
    : customFrom;
  const to = period === "custom" ? customTo : dayKey(today);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    appApi<Report>(`/reports/occupancy?date_from=${from}&date_to=${to}`)
      .then((r) => { setData(r); setError(""); })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el reporte"))
      .finally(() => setLoading(false));
  }, [from, to]);

  const tag = `${from}-a-${to}`;
  const cell = (wd: number, hr: number) => data?.heatmap.find((c) => c.weekday === wd && c.hour === hr);
  const maxIncomeCourt = Math.max(1, ...(data?.by_court || []).map((c) => c.income));
  const maxIncomeDay = Math.max(1, ...(data?.by_weekday || []).map((c) => c.income));
  const maxSource = Math.max(1, ...(data?.by_source || []).map((c) => c.bookings));
  const maxProduct = Math.max(1, ...(data?.buffet?.ranking || []).map((c) => c.quantity));

  function exportHeatmap() {
    if (!data) return;
    const rows: (string | number)[][] = [["Día", "Hora", "% ocupación", "Horas reservadas", "Horas disponibles"]];
    data.heatmap.forEach((c) => rows.push([data.weekdays[c.weekday], `${String(c.hour).padStart(2, "0")}:00`, c.pct, c.booked_hours, c.available_hours]));
    downloadCsv(`deportia-ocupacion-dia-hora-${tag}.csv`, rows);
  }
  function exportCourts() {
    if (!data) return;
    const rows: (string | number)[][] = [["Cancha", "Deporte", "% ocupación", "Horas reservadas", "Horas disponibles", "Turnos", "Ingresos"]];
    data.by_court.forEach((c) => rows.push([c.name, c.sport, c.pct, c.booked_hours, c.available_hours, c.bookings, c.income]));
    downloadCsv(`deportia-ocupacion-canchas-${tag}.csv`, rows);
  }
  function exportSports() {
    if (!data) return;
    const rows: (string | number)[][] = [["Deporte", "% ocupación", "Horas reservadas", "Horas disponibles", "Turnos", "Ingresos"]];
    data.by_sport.forEach((c) => rows.push([c.label, c.pct, c.booked_hours, c.available_hours, c.bookings, c.income]));
    downloadCsv(`deportia-ocupacion-deportes-${tag}.csv`, rows);
  }
  function exportSlots() {
    if (!data) return;
    const rows: (string | number)[][] = [["Tipo", "Franja", "% ocupación", "Sugerencia"]];
    data.peaks.forEach((c) => rows.push(["Hora pico", c.label, c.pct, c.suggestion]));
    data.dead.forEach((c) => rows.push(["Hora muerta", c.label, c.pct, c.suggestion]));
    downloadCsv(`deportia-horas-pico-y-muertas-${tag}.csv`, rows);
  }
  function exportWeekdays() {
    if (!data) return;
    const rows: (string | number)[][] = [["Día", "Turnos", "Ingresos"]];
    data.by_weekday.forEach((c) => rows.push([c.label, c.bookings, c.income]));
    downloadCsv(`deportia-ingresos-por-dia-${tag}.csv`, rows);
  }
  function exportSources() {
    if (!data) return;
    const rows: (string | number)[][] = [["Origen", "Turnos", "Ingresos"]];
    data.by_source.forEach((c) => rows.push([c.label, c.bookings, c.income]));
    downloadCsv(`deportia-origen-de-reservas-${tag}.csv`, rows);
  }
  function exportProducts() {
    if (!data?.buffet) return;
    const rows: (string | number)[][] = [["Producto", "Cantidad", "Total"]];
    data.buffet.ranking.forEach((c) => rows.push([c.description, c.quantity, c.total]));
    downloadCsv(`deportia-productos-mas-vendidos-${tag}.csv`, rows);
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">REPORTES</span>
          <h1>Ocupación</h1>
          <p>Cuándo se llenan las canchas, cuándo quedan vacías y de dónde viene la plata.</p>
        </div>
      </div>

      <div className="dp-toolbar">
        <div className="dp-chip-filters">
          {([["30", "Últimos 30 días"], ["90", "Últimos 90 días"], ["mes", "Este mes"], ["custom", "Elegir fechas"]] as [Period, string][]).map(([k, label]) => (
            <button key={k} className={`dp-filter-chip ${period === k ? "is-on" : ""}`} onClick={() => setPeriod(k)}>{label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="dp-filters">
            <input type="date" value={customFrom} max={customTo} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} aria-label="Desde" />
            <input type="date" value={customTo} min={customFrom} onChange={(e) => e.target.value && setCustomTo(e.target.value)} aria-label="Hasta" />
          </div>
        )}
      </div>
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && !data ? (
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      ) : !data ? null : data.available_hours === 0 ? (
        <div className="products-empty"><h3>Todavía no hay canchas activas</h3><p>Creá tus canchas para ver la ocupación.</p></div>
      ) : (
        <>
          <div className="dashboard-cards">
            <div className="dashboard-card">
              <span>Ocupación</span>
              <strong>{data.occupancy_pct}%</strong>
              <small>{data.booked_hours} h reservadas de {data.available_hours} h</small>
              <div className="dp-progress"><div style={{ width: `${data.occupancy_pct}%` }} /></div>
            </div>
            <div className="dashboard-card">
              <span>Ingresos por turnos</span>
              <strong>{money(data.income_total)}</strong>
              <small>Ticket promedio {money(data.average_ticket)} · {data.paid_bookings} cobrados</small>
            </div>
            <div className="dashboard-card">
              <span>Ausencias</span>
              <strong>{data.no_show_rate}%</strong>
              <small>{data.no_shows} turno{data.no_shows === 1 ? "" : "s"} sin presentarse</small>
            </div>
            <div className="dashboard-card">
              <span>Cancelaciones</span>
              <strong>{data.cancellation_rate}%</strong>
              <small>{data.cancellations} de {data.bookings_total} reservas</small>
            </div>
          </div>

          {/* ---------- Mapa de calor ---------- */}
          <div className="dashboard-section" style={{ marginBottom: 16 }}>
            <div className="section-heading dp-heading-row">
              <div><h2>Ocupación por día y hora</h2><p>% de horas reservadas sobre las disponibles · más oscuro = más ocupado</p></div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div className="dp-heat-legend" aria-hidden="true">
                  <span>0%</span>
                  {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`dp-heat-${l}`} />)}
                  <span>100%</span>
                </div>
                <button className="secondary-button" onClick={exportHeatmap}>Exportar CSV</button>
              </div>
            </div>
            <div className="dp-heat-wrap">
              <table className="dp-heat">
                <thead>
                  <tr><th></th>{data.hours.map((h) => <th key={h}>{String(h).padStart(2, "0")}</th>)}</tr>
                </thead>
                <tbody>
                  {data.weekdays.map((w, wd) => (
                    <tr key={w}>
                      <th>{w}</th>
                      {data.hours.map((h) => {
                        const c = cell(wd, h);
                        if (!c) return <td key={h} className="dp-heat-off" title={`${w} ${String(h).padStart(2, "0")}:00 · cerrado`} />;
                        return (
                          <td key={h} className={`dp-heat-${heatLevel(c.pct)}`}
                            title={`${w} ${String(h).padStart(2, "0")}:00 · ${c.pct}% · ${c.booked_hours} h reservadas de ${c.available_hours} h`}>
                            {Math.round(c.pct)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- Horas pico y muertas ---------- */}
          <div className="dp-grid-2">
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Horas pico</h2><p>Las 5 franjas que más se llenan</p></div>
                <button className="secondary-button" onClick={exportSlots}>Exportar CSV</button>
              </div>
              {data.peaks.length === 0 ? <p className="dp-muted">Todavía no hay reservas en estas fechas.</p> : (
                <ul className="dp-slot-tips">
                  {data.peaks.map((s) => (
                    <li key={`${s.weekday}-${s.hour}`}>
                      <span className="dp-pill dp-pill-green">{s.pct}%</span>
                      <div><strong>{s.label}</strong><small>{s.suggestion}</small></div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dashboard-section">
              <div className="section-heading"><h2>Horas muertas</h2><p>Las 5 franjas más vacías</p></div>
              <ul className="dp-slot-tips">
                {data.dead.map((s) => (
                  <li key={`${s.weekday}-${s.hour}`}>
                    <span className="dp-pill dp-pill-gray">{s.pct}%</span>
                    <div><strong>{s.label}</strong><small>{s.suggestion}</small></div>
                  </li>
                ))}
              </ul>
              <p className="dp-muted" style={{ marginTop: 10 }}>Los descuentos y recargos por horario se cargan en Configuración › Precios por horario.</p>
            </div>
          </div>

          {/* ---------- Canchas y deportes ---------- */}
          <div className="dp-grid-2">
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Ocupación por cancha</h2><p>Con turnos e ingresos</p></div>
                <button className="secondary-button" onClick={exportCourts}>Exportar CSV</button>
              </div>
              <ul className="dp-hbars">
                {data.by_court.map((c) => (
                  <HBar key={c.court_id} label={`${c.name}${c.active ? "" : " (inactiva)"}`} pct={c.pct}
                    value={`${c.pct}% · ${c.bookings} turnos · ${money(c.income)}`}
                    title={`${c.booked_hours} h reservadas de ${c.available_hours} h`} />
                ))}
              </ul>
            </div>
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Ocupación por deporte</h2><p>Sumando todas sus canchas</p></div>
                <button className="secondary-button" onClick={exportSports}>Exportar CSV</button>
              </div>
              <ul className="dp-hbars">
                {data.by_sport.map((c) => (
                  <HBar key={c.sport} label={c.label} pct={c.pct} value={`${c.pct}% · ${c.bookings} turnos · ${money(c.income)}`}
                    title={`${c.booked_hours} h reservadas de ${c.available_hours} h`} />
                ))}
              </ul>
              <div className="section-heading" style={{ marginTop: 18 }}><h2>Ingresos por cancha</h2></div>
              <ul className="dp-hbars">
                {data.by_court.map((c) => <HBar key={c.court_id} label={c.name} pct={(c.income / maxIncomeCourt) * 100} value={money(c.income)} />)}
              </ul>
            </div>
          </div>

          {/* ---------- Ingresos por día y por origen ---------- */}
          <div className="dp-grid-2">
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>Ingresos por día de la semana</h2><p>Según el día en que se jugó el turno</p></div>
                <button className="secondary-button" onClick={exportWeekdays}>Exportar CSV</button>
              </div>
              <ul className="dp-hbars">
                {data.by_weekday.map((c) => <HBar key={c.weekday} label={c.label} pct={(c.income / maxIncomeDay) * 100} value={`${money(c.income)} · ${c.bookings} turnos`} />)}
              </ul>
            </div>
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div><h2>De dónde vienen las reservas</h2><p>Web, sistema, turnos fijos y torneos</p></div>
                <button className="secondary-button" onClick={exportSources}>Exportar CSV</button>
              </div>
              {data.by_source.length === 0 ? <p className="dp-muted">Todavía no hay reservas en estas fechas.</p> : (
                <ul className="dp-hbars">
                  {data.by_source.map((c) => <HBar key={c.source} label={c.label} pct={(c.bookings / maxSource) * 100} value={`${c.bookings} turnos · ${money(c.income)}`} />)}
                </ul>
              )}
            </div>
          </div>

          {/* ---------- Buffet ---------- */}
          {data.buffet && (
            <div className="dashboard-section">
              <div className="section-heading dp-heading-row">
                <div>
                  <h2>Buffet</h2>
                  <p>Vendido {money(data.buffet.total)} · en turnos {money(data.buffet.booking_total)} · en mostrador {money(data.buffet.counter_total)}</p>
                </div>
                <button className="secondary-button" onClick={exportProducts} disabled={!data.buffet.ranking.length}>Exportar CSV</button>
              </div>
              {data.buffet.ranking.length === 0 ? <p className="dp-muted">No hubo ventas de buffet en estas fechas.</p> : (
                <ul className="dp-hbars">
                  {data.buffet.ranking.map((c) => <HBar key={c.description} label={c.description} pct={(c.quantity / maxProduct) * 100} value={`${c.quantity} · ${money(c.total)}`} />)}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Reportes;
