import { useEffect, useRef, useState } from "react";
import type { PointerEvent as PEvent, KeyboardEvent as KEvent } from "react";
import { appApi, COURT_STATUS, SPORT_LABELS } from "../config";
import type { Booking, Court } from "../config";
import CourtIcon from "./CourtIcon";

/**
 * Plano del complejo: las canchas vistas desde arriba, ubicadas como en la realidad.
 * El encargado las arrastra (o usa las flechas) y guarda. Las que no tienen posición se acomodan solas en grilla.
 * El color es el estado en el momento elegido: verde libre · naranja reservada · rojo en uso.
 */
const W = 900, H = 560, SNAP = 10, DEF_W = 260, DEF_H = 170;

interface Box { x: number; y: number; w: number; h: number }
const auto = (i: number): Box => ({ x: 20 + (i % 3) * 290, y: 20 + Math.floor(i / 3) * 200, w: DEF_W, h: DEF_H });
const boxOf = (c: Court, i: number): Box => (c.map_x == null || c.map_y == null ? auto(i) : { x: c.map_x, y: c.map_y, w: c.map_w || DEF_W, h: c.map_h || DEF_H });

export interface PlanPalette { [status: string]: { color: string; solid: string; label: string } }
interface Props {
  courts: Court[];
  /** colores y textos por estado (por defecto los del panel) */
  palette?: PlanPalette;
  /** solo lectura para la web pública: se recorta al área ocupada por las canchas */
  fit?: boolean;
  /** texto de abajo de cada cancha (por defecto: el deporte o el cliente) */
  caption?: (c: Court, status: string) => string;
  /** al tocar una cancha (web de reservas). Si falta, se abre el turno como en el panel */
  onPick?: (c: Court) => void;
  canPick?: (status: string) => boolean;
  statusFor: (c: Court) => { status: string; booking: Booking | null };
  selectedId: number | null;
  onSelect: (id: number) => void;
  onOpenBooking: (b: Booking) => void;
  canManage: boolean;
  onSaved: () => void | Promise<void>;
}

export default function CourtPlan({ courts, statusFor, selectedId, onSelect, onOpenBooking, canManage, onSaved, palette = COURT_STATUS, fit = false, caption, onPick, canPick }: Props) {
  const [edit, setEdit] = useState(false);
  const [boxes, setBoxes] = useState<Record<number, Box>>({});
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [scale, setScale] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (dirty) return;
    const b: Record<number, Box> = {};
    courts.forEach((c, i) => { b[c.id] = boxOf(c, i); });
    setBoxes(b);
  }, [courts, dirty]);

  // área visible: todo el plano, o (web pública) solo lo que ocupan las canchas
  const list = courts.map((c) => boxes[c.id]).filter(Boolean);
  const pad = 20;
  const ox = fit && list.length ? Math.min(...list.map((b) => b.x)) - pad : 0;
  const oy = fit && list.length ? Math.min(...list.map((b) => b.y)) - pad : 0;
  const cw = fit && list.length ? Math.max(...list.map((b) => b.x + b.w)) + pad - ox : W;
  const ch = fit && list.length ? Math.max(...list.map((b) => b.y + b.h)) + pad - oy : H;

  // En celular el plano entero queda muy chico: se ve con zoom legible y desplazamiento lateral (la pantalla ofrece además tarjetas/lista).
  // Mientras se acomoda, el plano se ve completo para poder arrastrar cada cancha con el dedo.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const adjust = () => {
      const w = el.clientWidth;
      const fitScale = Math.min(1, w / cw);
      setScale(edit || w >= 640 ? fitScale : Math.max(0.62, fitScale));
    };
    adjust();
    const ro = new ResizeObserver(adjust);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cw, edit]);

  const move = (id: number, p: Partial<Box>) => { setBoxes((b) => ({ ...b, [id]: { ...b[id], ...p } })); setDirty(true); };
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v / SNAP) * SNAP));

  function down(e: PEvent, c: Court) {
    onSelect(c.id);
    if (!edit) return;
    const r = canvas.current!.getBoundingClientRect(), b = boxes[c.id];
    drag.current = { id: c.id, dx: (e.clientX - r.left) / scale - b.x, dy: (e.clientY - r.top) / scale - b.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function mv(e: PEvent, c: Court) {
    const d = drag.current;
    if (!edit || !d || d.id !== c.id) return;
    const r = canvas.current!.getBoundingClientRect(), b = boxes[c.id];
    move(c.id, { x: clamp((e.clientX - r.left) / scale - d.dx, W - b.w), y: clamp((e.clientY - r.top) / scale - d.dy, H - b.h) });
  }
  function key(e: KEvent, c: Court) {
    if (!edit) return;
    const step = e.shiftKey ? 50 : SNAP, b = boxes[c.id];
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = m[e.key];
    if (!v) return;
    e.preventDefault();
    move(c.id, { x: clamp(b.x + v[0], W - b.w), y: clamp(b.y + v[1], H - b.h) });
  }
  const selBox = selectedId != null ? boxes[selectedId] : null;
  const resize = (dw: number, dh: number) => {
    if (selectedId == null || !selBox) return;
    move(selectedId, { w: Math.max(100, Math.min(400, selBox.w + dw)), h: Math.max(70, Math.min(300, selBox.h + dh)) });
  };
  async function save() {
    try {
      await appApi("/courts/layout", { method: "PUT", body: { courts: courts.map((c) => ({ id: c.id, map_x: boxes[c.id].x, map_y: boxes[c.id].y, map_w: boxes[c.id].w, map_h: boxes[c.id].h })) } });
      setDirty(false); setEdit(false); setMsg("Plano guardado"); await onSaved();
      setTimeout(() => setMsg(""), 2500);
    } catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo guardar"); }
  }
  async function reset() {
    setBoxes(Object.fromEntries(courts.map((c, i) => [c.id, auto(i)])));
    setDirty(true);
  }

  return (
    <div className="dp-plan" ref={root}>
      {canManage && (
        <div className="dp-plan-bar">
          {!edit ? (
            <button className="secondary-button" onClick={() => setEdit(true)}>Acomodar canchas</button>
          ) : (
            <>
              <span className="dp-muted">Arrastrá cada cancha (o usá las flechas) y dejala como en tu complejo.</span>
              <button className="secondary-button" onClick={() => resize(20, 10)} disabled={!selBox}>Agrandar</button>
              <button className="secondary-button" onClick={() => resize(-20, -10)} disabled={!selBox}>Achicar</button>
              <button className="secondary-button" onClick={reset}>Ordenar en grilla</button>
              <button className="secondary-button" onClick={() => { setDirty(false); setEdit(false); }}>Cancelar</button>
              <button className="primary-button" disabled={!dirty} onClick={save}>Guardar plano</button>
            </>
          )}
          {msg && <span className="dp-muted" role="status">{msg}</span>}
        </div>
      )}
      <div className="dp-plan-legend"><span><i className="dp-plan-sw" />Al aire libre</span><span><i className="dp-plan-sw is-covered" />Techada</span></div>
      <div className="dp-plan-wrap" ref={wrap}>
       <div style={{ position: "relative", width: cw * scale, height: ch * scale }}>
        <div className={`dp-plan-canvas ${edit ? "is-edit" : ""}`} ref={canvas} style={{ width: cw, height: ch, transform: `scale(${scale})` }}>
          {courts.map((c) => {
            const b = boxes[c.id];
            if (!b) return null;
            const { status, booking } = statusFor(c);
            const col = palette[status].color;
            const pickable = !edit && onPick && (canPick ? canPick(status) : true);
            return (
              <div key={c.id} role="button" tabIndex={0}
                aria-label={`${c.name}${c.covered ? ", techada" : ""}, ${palette[status].label}${edit ? ". Flechas para mover" : ""}`}
                className={`dp-plan-court ${c.covered ? "is-covered" : ""} ${c.id === selectedId ? "is-selected" : ""} ${onPick && !pickable ? "is-disabled" : ""}`}
                style={{ left: b.x - ox, top: b.y - oy, width: b.w, height: b.h, borderColor: col }}
                onPointerDown={(e) => down(e, c)} onPointerMove={(e) => mv(e, c)} onPointerUp={() => { drag.current = null; }}
                onKeyDown={(e) => key(e, c)} onClick={() => { if (edit) return; if (onPick) { if (pickable) onPick(c); } else if (booking) onOpenBooking(booking); }}>
                <div className="dp-plan-art"><CourtIcon sport={c.sport} width={b.w - 12} fill={col} /></div>
                <div className="dp-plan-label">
                  <strong>{c.name}</strong>
                  <span className="dp-pill" style={{ background: palette[status].solid, color: "#fff" }}>{palette[status].label}</span>
                </div>
                <small>{c.covered ? "Techada · " : ""}{caption ? caption(c, status) : booking ? booking.customer_name : SPORT_LABELS[c.sport]}</small>
              </div>
            );
          })}
        </div>
       </div>
      </div>
    </div>
  );
}
