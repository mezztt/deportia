import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  appApi, money, timeRange, hhmm, dayLabel, BOOKING_STATUS, PAYMENT_METHODS, PAYMENT_LABELS, SPORT_LABELS,
  getSessionUser, hasModule,
} from "../config";
import type { Booking, BookingItem, BuffetProduct, ClientAlert } from "../config";
import CourtIcon from "./CourtIcon";

interface ItemsResponse { booking: Booking; items: BookingItem[] }

interface Props {
  booking: Booking;
  onClose: () => void;
  onChanged: (b: Booking) => void;
  onEdit?: (b: Booking) => void;
}

/**
 * Detalle de un turno con todas las acciones del encargado:
 * confirmar código (la cancha pasa a rojo), cobrar, finalizar, cancelar.
 */
function BookingModal({ booking, onClose, onChanged, onEdit }: Props) {
  const [b, setB] = useState<Booking>(booking);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typedCode, setTypedCode] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState("EFECTIVO");
  const [payAmount, setPayAmount] = useState(String(booking.remaining ?? booking.price ?? ""));
  const [depMethod, setDepMethod] = useState("TRANSFERENCIA");
  const [showDep, setShowDep] = useState(false);

  const navigate = useNavigate();
  const user = getSessionUser();
  const withBuffet = hasModule(user, "buffet");
  const withClients = hasModule(user, "clientes");
  const isMatch = booking.source === "TORNEO";

  // ---- módulo Clientes: aviso de ausencias / deuda / bloqueo ----
  const [alertInfo, setAlertInfo] = useState<ClientAlert | null>(null);
  useEffect(() => {
    if (!withClients || !booking.client_id) return;
    appApi<ClientAlert>(`/clients/alert?client_id=${booking.client_id}`).then(setAlertInfo).catch(() => {});
  }, [booking.id]);

  // ---- módulo Buffet: consumos y extras del turno ----
  const [items, setItems] = useState<BookingItem[]>([]);
  const [products, setProducts] = useState<BuffetProduct[]>([]);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [freeAmount, setFreeAmount] = useState("");
  const [payMode, setPayMode] = useState<"all" | "items">("all");

  useEffect(() => {
    if (!withBuffet) return;
    appApi<ItemsResponse>(`/buffet/bookings/${booking.id}/items`).then((r) => setItems(r.items)).catch(() => {});
    appApi<{ products: BuffetProduct[] }>("/buffet/products").then((r) => setProducts(r.products)).catch(() => {});
  }, [booking.id]);

  async function runItems(path: string, method: string, body?: unknown, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const r = await appApi<ItemsResponse>(path, { method, body });
      setItems(r.items);
      if (r.booking) { setB(r.booking); onChanged(r.booking); }
      setShowPay(false);
      // el stock pudo cambiar
      appApi<{ products: BuffetProduct[] }>("/buffet/products").then((x) => setProducts(x.products)).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }

  function addFreeLine() {
    if (!freeText.trim() || freeAmount === "") { setError("Escribí qué es y el monto."); return; }
    runItems(`/buffet/bookings/${booking.id}/items`, "POST", { description: freeText.trim(), unit_price: Number(freeAmount), quantity: 1 });
    setFreeText("");
    setFreeAmount("");
  }

  // primero los productos del deporte de esta cancha, después los generales, al final el resto
  const sortedProducts = [...products].sort((a, c) => {
    const rank = (p: BuffetProduct) => (p.sport && p.sport === booking.court_sport ? 0 : !p.sport ? 1 : 2);
    return rank(a) - rank(c) || a.name.localeCompare(c.name);
  });
  const visibleProducts = showAllProducts ? sortedProducts : sortedProducts.slice(0, 8);

  async function run(path: string, body?: unknown, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const updated = await appApi<Booking>(path, { method: "POST", body });
      setB(updated);
      onChanged(updated);
      setShowPay(false);
      setTypedCode("");
      if (withBuffet) {
        // el cobro pudo incluir los consumos: se vuelven a leer
        appApi<ItemsResponse>(`/buffet/bookings/${updated.id}/items`).then((r) => setItems(r.items)).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }

  const st = BOOKING_STATUS[b.status];
  const start = new Date(b.start_at);
  const phoneDigits = (b.customer_phone || "").replace(/\D/g, "");

  const itemsUnpaid = withBuffet ? Number(b.items_unpaid || 0) : 0;
  const itemsPaid = items.filter((i) => i.paid).reduce((sum, i) => sum + i.total, 0);
  const courtDue = b.paid || isMatch ? 0 : Number(b.remaining ?? b.price ?? 0);
  const canConsume = withBuffet && b.status !== "CANCELADO" && b.status !== "PENDIENTE_PAGO";
  const finished = b.status === "FINALIZADO" || b.status === "AUSENTE";
  const payTotal = payMode === "items" ? itemsUnpaid : Number(payAmount || 0) + itemsUnpaid;

  function openPay(mode: "all" | "items") {
    setPayMode(mode);
    setPayAmount(String(b.remaining ?? b.price ?? ""));
    setShowPay(true);
  }

  function submitPay() {
    if (payMode === "items") runItems(`/buffet/bookings/${b.id}/pay-items`, "POST", { payment_method: payMethod });
    else run(`/bookings/${b.id}/pay`, { amount: Number(payAmount), payment_method: payMethod, include_items: itemsUnpaid > 0 });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="product-modal dp-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {b.court_sport && <CourtIcon sport={b.court_sport} width={64} />}
            <div>
              <span className="dashboard-eyebrow">{b.court_name} · {b.court_sport ? SPORT_LABELS[b.court_sport] : ""}</span>
              <h2 style={{ margin: "4px 0" }}>{dayLabel(start)} · {timeRange(b.start_at, b.end_at)}</h2>
              <span className={`dp-pill dp-pill-${st.tone}`}>{st.label}</span>
              {b.source === "WEB" && <span className="dp-pill dp-pill-blue" style={{ marginLeft: 6 }}>Reservado por la web</span>}
              {(b.source === "FIJO" || b.recurring_id) && <span className="dp-pill dp-pill-green" style={{ marginLeft: 6 }}>Turno fijo</span>}
              {isMatch && <span className="dp-pill dp-pill-orange" style={{ marginLeft: 6 }}>Partido de torneo</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* ---------- AVISO DEL CLIENTE (ausencias, deuda, bloqueo) ---------- */}
        {alertInfo && alertInfo.warnings.length > 0 && (
          <div className={`dp-alert ${alertInfo.client?.blocked ? "dp-alert-red" : ""}`} role="alert">
            <strong>⚠ Ojo con {alertInfo.client?.name}</strong>
            <ul>{alertInfo.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            <button className="dp-link-button" onClick={() => navigate(`/app/clientes?id=${alertInfo.client?.id}`)}>Ver ficha del cliente</button>
          </div>
        )}

        {/* ---------- SEÑA PENDIENTE (reserva web) ---------- */}
        {b.status === "PENDIENTE_PAGO" && b.deposit && (
          <div className="dp-deposit-wait">
            <div>
              <span className="dp-checkin-label">Esperando la seña por Mercado Pago</span>
              <strong>{money(b.deposit.amount)}</strong>
              <small className="dp-muted">Si no se paga antes de las {hhmm(b.deposit.expires_at)}, la cancha se libera sola.</small>
            </div>
            {!showDep ? (
              <button className="secondary-button" onClick={() => setShowDep(true)}>Ya me la pagó por otro medio</button>
            ) : (
              <div className="dp-deposit-manual">
                <select value={depMethod} onChange={(e) => setDepMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                </select>
                <button className="primary-button dp-btn-green" disabled={busy}
                  onClick={() => run(`/bookings/${b.id}/confirm-deposit`, { amount: b.deposit!.amount, payment_method: depMethod })}>
                  Confirmar seña
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- CÓDIGO / CHECK-IN ---------- */}
        {b.status === "RESERVADO" && (
          <div className="dp-checkin">
            <div>
              <span className="dp-checkin-label">Código del turno</span>
              <div className="dp-code">{b.code}</div>
              <small className="dp-muted">Pedile el código al jugador y fijate que coincida.</small>
            </div>
            <div className="dp-checkin-actions">
              <input
                className="dp-code-input"
                placeholder="Código que te dicen"
                value={typedCode}
                maxLength={6}
                onChange={(e) => setTypedCode(e.target.value.toUpperCase())}
              />
              <button
                className="primary-button dp-btn-green"
                disabled={busy}
                onClick={() => run(`/bookings/${b.id}/check-in`, { code: typedCode || b.code })}
              >
                {typedCode ? "Verificar y confirmar llegada" : "Coincide · Confirmar llegada"}
              </button>
            </div>
          </div>
        )}
        {b.status !== "RESERVADO" && (
          <div className="dp-code-line">Código <strong>{b.code}</strong>
            {b.checked_in_at && <> · llegaron {hhmm(b.checked_in_at)}</>}
          </div>
        )}

        {/* ---------- DATOS ---------- */}
        <div className="dp-info-grid">
          <div><span>A nombre de</span><strong>{b.customer_name}</strong></div>
          <div>
            <span>Teléfono</span>
            <strong>
              {b.customer_phone ? (
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">{b.customer_phone}</a>
              ) : "—"}
            </strong>
          </div>
          <div><span>Personas</span><strong>{b.players_count ?? "—"}</strong></div>
          {!isMatch && <div><span>Precio de la cancha</span><strong>{money(b.price)}</strong></div>}
          {b.deposit?.status === "PAGADA" && (
            <div><span>Seña pagada</span><strong className="dp-green-text">{money(b.deposit.amount)} · {PAYMENT_LABELS[b.deposit.method || ""] || "Mercado Pago"}</strong></div>
          )}
          {b.customer_email && <div><span>Email</span><strong>{b.customer_email}</strong></div>}
          {b.notes && <div style={{ gridColumn: "1 / -1" }}><span>Notas</span><strong>{b.notes}</strong></div>}
        </div>

        {/* ---------- CONSUMOS Y EXTRAS (módulo Buffet) ---------- */}
        {canConsume && (
          <div className="dp-consumos">
            <div className="dp-consumos-head">
              <span className="dp-checkin-label">Consumos y extras</span>
              {items.length > 0 && <strong>{money(items.reduce((sum, i) => sum + i.total, 0))}</strong>}
            </div>
            {products.length === 0 ? (
              <p className="dp-muted">Todavía no hay productos cargados. Cargalos en Buffet o sumá un renglón libre acá abajo.</p>
            ) : (
              <div className="dp-prod-grid">
                {visibleProducts.map((p) => (
                  <button key={p.id} type="button" className="dp-prod-btn" disabled={busy || (p.track_stock && p.stock <= 0)}
                    title={p.track_stock ? `Quedan ${p.stock}` : undefined}
                    onClick={() => runItems(`/buffet/bookings/${b.id}/items`, "POST", { product_id: p.id, quantity: 1 })}>
                    <strong>{p.name}</strong>
                    <small>{p.track_stock && p.stock <= 0 ? "Sin stock" : `+ ${money(p.price)}`}</small>
                  </button>
                ))}
                {sortedProducts.length > 8 && (
                  <button type="button" className="dp-prod-btn dp-prod-more" onClick={() => setShowAllProducts(!showAllProducts)}>
                    <strong>{showAllProducts ? "Ver menos" : `Ver los ${sortedProducts.length}`}</strong>
                  </button>
                )}
              </div>
            )}

            {items.length > 0 && (
              <ul className="dp-item-list">
                {items.map((i) => (
                  <li key={i.id}>
                    <div className="dp-item-main">
                      <strong>{i.description}</strong>
                      <small>{money(i.unit_price)} c/u{i.paid ? ` · cobrado (${PAYMENT_LABELS[i.payment_method || ""] || "—"})` : ""}</small>
                    </div>
                    {i.paid ? (
                      <span className="dp-qty-fixed">× {i.quantity}</span>
                    ) : (
                      <div className="dp-qty">
                        <button type="button" disabled={busy} aria-label="Quitar uno"
                          onClick={() => runItems(`/buffet/items/${i.id}`, "PUT", { quantity: i.quantity - 1 })}>−</button>
                        <span>{i.quantity}</span>
                        <button type="button" disabled={busy} aria-label="Sumar uno"
                          onClick={() => runItems(`/buffet/items/${i.id}`, "PUT", { quantity: i.quantity + 1 })}>+</button>
                      </div>
                    )}
                    <strong className="dp-item-total">{money(i.total)}</strong>
                  </li>
                ))}
              </ul>
            )}

            <div className="dp-free-line">
              <input placeholder="Otro: ej. pelota rota" value={freeText} maxLength={150} onChange={(e) => setFreeText(e.target.value)} />
              <input type="number" min="0" placeholder="Monto" value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)} />
              <button type="button" className="secondary-button" disabled={busy} onClick={addFreeLine}>Sumar</button>
            </div>
          </div>
        )}

        {/* ---------- PAGO ---------- */}
        <div className="dp-pay-box">
          {b.status === "CANCELADO" ? (
            <p className="dp-muted">Turno cancelado.{b.deposit?.status === "PAGADA" ? ` Tenía una seña pagada de ${money(b.deposit.amount)}.` : ""}</p>
          ) : b.status === "PENDIENTE_PAGO" ? (
            <p className="dp-muted">Se cobra cuando se confirme la seña.</p>
          ) : showPay ? (
            <div className="dp-pay-form">
              {payMode === "all" ? (
                <>
                  <div className="dp-pay-total">
                    <span>{b.deposit?.status === "PAGADA" ? "Saldo de la cancha" : "Cancha"}</span>
                    <input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  {itemsUnpaid > 0 && (
                    <div className="dp-pay-line"><span>Consumos y extras</span><strong>{money(itemsUnpaid)}</strong></div>
                  )}
                </>
              ) : (
                <div className="dp-pay-line"><span>Solo consumos y extras</span><strong>{money(itemsUnpaid)}</strong></div>
              )}
              <span className="dp-checkin-label">Método de pago</span>
              <div className="dp-method-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" className={`dp-method ${payMethod === m ? "is-on" : ""}`} onClick={() => setPayMethod(m)}>
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowPay(false)}>Volver</button>
                <button className="primary-button dp-btn-green" disabled={busy || (payMode === "all" && !Number(payAmount)) || payTotal <= 0}
                  onClick={submitPay}>
                  Registrar pago de {money(payTotal)}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* cancha */}
              {isMatch ? (
                <p className="dp-muted" style={{ margin: 0 }}>Partido de torneo: la cancha no se cobra como turno.</p>
              ) : b.paid ? (
                <div className="dp-pay-done">
                  <div>
                    <span className="dp-pill dp-pill-green">Cancha pagada</span>{" "}
                    <strong>{money(b.paid_amount)}</strong> · {PAYMENT_LABELS[b.payment_method || ""] || b.payment_method}
                  </div>
                  <button className="secondary-button" disabled={busy}
                    onClick={() => run(`/bookings/${b.id}/unpay`, undefined, "¿Deshacer el cobro de la cancha? Se borra el ingreso de Facturación.")}>
                    Deshacer cobro
                  </button>
                </div>
              ) : (
                <div className="dp-pay-done">
                  <div>
                    <span className="dp-pill dp-pill-orange">Sin cobrar</span>{" "}
                    {b.deposit?.status === "PAGADA"
                      ? <>Cancha: resta <strong>{money(b.remaining)}</strong> <small className="dp-muted">(ya dejó {money(b.deposit.amount)} de seña)</small></>
                      : <>Cancha <strong>{money(b.price)}</strong></>}
                    {itemsUnpaid > 0 && <> + consumos <strong>{money(itemsUnpaid)}</strong> = <strong>{money(courtDue + itemsUnpaid)}</strong></>}
                  </div>
                  <button className="primary-button dp-btn-green" onClick={() => openPay("all")}>
                    {itemsUnpaid > 0 ? `$ Cobrar todo · ${money(courtDue + itemsUnpaid)}` : "$ Pago"}
                  </button>
                </div>
              )}

              {/* consumos */}
              {itemsUnpaid > 0 && (
                <div className="dp-pay-done dp-pay-extra">
                  <div>
                    {(b.paid || isMatch) && <><span className="dp-pill dp-pill-orange">Consumos sin cobrar</span>{" "}<strong>{money(itemsUnpaid)}</strong></>}
                  </div>
                  <button className="secondary-button" disabled={busy} onClick={() => openPay("items")}>
                    {b.paid || isMatch ? `$ Cobrar consumos · ${money(itemsUnpaid)}` : "Cobrar solo los consumos"}
                  </button>
                </div>
              )}
              {withBuffet && itemsPaid > 0 && (
                <div className="dp-pay-done dp-pay-extra">
                  <div><span className="dp-pill dp-pill-green">Consumos pagados</span>{" "}<strong>{money(itemsPaid)}</strong></div>
                  <button className="secondary-button" disabled={busy}
                    onClick={() => runItems(`/buffet/bookings/${b.id}/unpay-items`, "POST", undefined, "¿Deshacer el cobro de los consumos? Se borra el ingreso de Buffet.")}>
                    Deshacer cobro
                  </button>
                </div>
              )}
              {finished && courtDue + itemsUnpaid > 0 && (
                <div className="dp-due">Falta cobrar {money(courtDue + itemsUnpaid)}</div>
              )}
            </>
          )}
        </div>

        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

        {/* ---------- ACCIONES ---------- */}
        <div className="modal-actions" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(b.status === "RESERVADO" || b.status === "EN_CURSO" || b.status === "PENDIENTE_PAGO") && (
              <button className="product-action-delete" disabled={busy}
                onClick={() => run(`/bookings/${b.id}/cancel`, undefined, b.recurring_id ? "¿Cancelar solo esta fecha del turno fijo? Las demás semanas siguen reservadas." : "¿Cancelar este turno? La cancha queda libre.")}>
                Cancelar turno
              </button>
            )}
            {b.status === "EN_CURSO" && (
              <button className="secondary-button" disabled={busy}
                onClick={() => run(`/bookings/${b.id}/finish`, undefined, "¿Terminar el turno ahora? La cancha queda libre.")}>
                Terminar ahora
              </button>
            )}
          </div>
          {onEdit && !isMatch && (b.status === "RESERVADO" || b.status === "EN_CURSO" || !b.paid) && b.status !== "CANCELADO" && (
            <button className="secondary-button" onClick={() => onEdit(b)}>Editar</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookingModal;
