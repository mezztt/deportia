import { useEffect, useMemo, useState } from "react";
import { appApi, money, PAYMENT_METHODS, PAYMENT_LABELS } from "../config";
import type { BuffetProduct } from "../config";

interface Props {
  onClose: () => void;
  onSold?: (total: number) => void;
}

interface Line { key: string; product_id: number | null; description: string; unit_price: number; quantity: number }

/** Venta de mostrador: vender productos del buffet sin un turno. */
function QuickSale({ onClose, onSold }: Props) {
  const [products, setProducts] = useState<BuffetProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [freeText, setFreeText] = useState("");
  const [freeAmount, setFreeAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    appApi<{ products: BuffetProduct[] }>("/buffet/products")
      .then((r) => setProducts(r.products))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los productos"))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  const total = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  function addProduct(p: BuffetProduct) {
    setDone(null);
    setLines((list) => {
      const found = list.find((l) => l.product_id === p.id);
      if (found) return list.map((l) => (l === found ? { ...l, quantity: l.quantity + 1 } : l));
      return [...list, { key: `p${p.id}`, product_id: p.id, description: p.name, unit_price: Number(p.price), quantity: 1 }];
    });
  }

  function addFree() {
    if (!freeText.trim() || freeAmount === "") { setError("Escribí qué es y el monto."); return; }
    setError("");
    setDone(null);
    setLines((list) => [...list, { key: `f${Date.now()}`, product_id: null, description: freeText.trim(), unit_price: Number(freeAmount), quantity: 1 }]);
    setFreeText("");
    setFreeAmount("");
  }

  function changeQty(key: string, delta: number) {
    setLines((list) => list.map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0));
  }

  async function sell() {
    if (!lines.length) return;
    setBusy(true);
    setError("");
    try {
      const r = await appApi<{ total: number }>("/buffet/sales", {
        method: "POST",
        body: {
          payment_method: method,
          items: lines.map((l) => (l.product_id
            ? { product_id: l.product_id, quantity: l.quantity }
            : { description: l.description, unit_price: l.unit_price, quantity: l.quantity })),
        },
      });
      setLines([]);
      setDone(r.total);
      onSold?.(r.total);
      appApi<{ products: BuffetProduct[] }>("/buffet/products").then((x) => setProducts(x.products)).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la venta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="product-modal dp-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div><span className="dashboard-eyebrow">BUFFET</span><h2>Venta rápida</h2></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
        ) : (
          <div className="dp-consumos" style={{ marginTop: 0 }}>
            {products.length > 8 && (
              <input className="dp-search" style={{ minWidth: 0, width: "100%" }} placeholder="Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} />
            )}
            {products.length === 0 ? (
              <p className="dp-muted">Todavía no hay productos. Cargalos en Buffet › Productos, o vendé con un renglón libre.</p>
            ) : (
              <div className="dp-prod-grid">
                {visible.map((p) => (
                  <button key={p.id} type="button" className="dp-prod-btn" disabled={p.track_stock && p.stock <= 0}
                    title={p.track_stock ? `Quedan ${p.stock}` : undefined} onClick={() => addProduct(p)}>
                    <strong>{p.name}</strong>
                    <small>{p.track_stock && p.stock <= 0 ? "Sin stock" : money(p.price)}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="dp-free-line">
              <input placeholder="Otro: descripción" value={freeText} maxLength={150} onChange={(e) => setFreeText(e.target.value)} />
              <input type="number" min="0" placeholder="Monto" value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)} />
              <button type="button" className="secondary-button" onClick={addFree}>Sumar</button>
            </div>

            {lines.length === 0 ? (
              <p className="dp-muted">{done !== null ? "" : "Tocá los productos para armar la venta."}</p>
            ) : (
              <ul className="dp-item-list">
                {lines.map((l) => (
                  <li key={l.key}>
                    <div className="dp-item-main"><strong>{l.description}</strong><small>{money(l.unit_price)} c/u</small></div>
                    <div className="dp-qty">
                      <button type="button" aria-label="Quitar uno" onClick={() => changeQty(l.key, -1)}>−</button>
                      <span>{l.quantity}</span>
                      <button type="button" aria-label="Sumar uno" onClick={() => changeQty(l.key, 1)}>+</button>
                    </div>
                    <strong className="dp-item-total">{money(l.unit_price * l.quantity)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {done !== null && <p className="dp-ok-msg" style={{ marginTop: 12 }}>✓ Venta registrada por {money(done)}. Ya está en Facturación como Buffet.</p>}
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

        {lines.length > 0 && (
          <div className="dp-pay-box" style={{ marginTop: 14 }}>
            <div className="dp-pay-form">
              <span className="dp-checkin-label">Método de pago</span>
              <div className="dp-method-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" className={`dp-method ${method === m ? "is-on" : ""}`} onClick={() => setMethod(m)}>{PAYMENT_LABELS[m]}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cerrar</button>
          <button className="primary-button dp-btn-green" disabled={busy || !lines.length || total <= 0} onClick={sell}>
            {busy ? "Registrando..." : `Cobrar ${money(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickSale;
