import { MODULE_LABELS } from "../../config";

/** Lugar reservado para los módulos del complejo que armamos en los próximos pasos. */
function ComingSoon({ module }: { module: string }) {
  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">DEPORTIA</span>
          <h1>{MODULE_LABELS[module] || module}</h1>
          <p>Este módulo está en construcción.</p>
        </div>
      </div>
      <div className="products-empty">
        <div className="products-empty-icon">◯</div>
        <h3>Próximamente</h3>
      </div>
    </section>
  );
}

export default ComingSoon;
