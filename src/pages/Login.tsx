import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, ADMIN_TOKEN_KEY, TOKEN_KEY, USER_KEY } from "../config";
import CourtIcon from "../components/CourtIcon";
import { BajaLoginLink } from "../components/ServiceCancel";
import { BrandWordmark, InstagramLink, PoweredBy, useBrandLinks } from "../components/Brand";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const links = useBrandLinks();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1) ¿Es el panel general (Mezztt)?
      const adminRes = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (adminRes.ok) {
        const data = await adminRes.json();
        localStorage.setItem(ADMIN_TOKEN_KEY, data.access_token);
        navigate("/admin");
        return;
      }

      // 2) Si no, es un usuario de un complejo
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "El email o la contraseña son incorrectos.");

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      navigate("/app");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "No se pudo conectar con el servidor."
          : err instanceof Error ? err.message : "No se pudo ingresar."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <BrandWordmark size={46} tagline="Turnos y canchas, sin vueltas" />
        </div>

        <div className="dp-login-courts" aria-hidden="true">
          <CourtIcon sport="futbol" width={84} />
          <CourtIcon sport="padel" width={84} />
          <CourtIcon sport="tenis" width={84} />
        </div>

        <div className="login-heading">
          <h2>Bienvenido</h2>
          <p>Ingresá a tu cuenta para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="tu@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="dp-follow">
          <span>Seguinos</span>
          <InstagramLink href={links.system_instagram_url} label="Seguí a Deportia en Instagram" />
        </div>

        <div className="login-footer"><PoweredBy /><BajaLoginLink className="sc-link sc-login-link" /></div>
      </section>
    </main>
  );
}

export default Login;
