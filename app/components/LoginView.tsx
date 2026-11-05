'use client';

import { useState, useEffect } from 'react';
import type { User } from '../lib/types';
import { signIn } from '../lib/services';

interface Props { onLogin: (user: User) => void; }

function buildRainDrops() {
  const colors = ['var(--red)', 'var(--purple)', 'var(--red)', 'var(--green)', 'var(--lip)'];
  return Array.from({ length: 36 }, (_, i) => {
    const d = 7 + Math.random() * 9;
    return {
      style: {
        '--x': `${(Math.random() * 98).toFixed(1)}%`,
        '--y': `${(Math.random() * 95).toFixed(1)}%`,
        '--s': `${(13 + Math.random() * 23).toFixed(0)}px`,
        '--o': `${(0.45 + Math.random() * 0.45).toFixed(2)}`,
        '--d': `${d.toFixed(1)}s`,
        '--delay': `${(-Math.random() * d).toFixed(1)}s`,
        '--sway': `${(-40 + Math.random() * 80).toFixed(0)}px`,
        '--c': colors[i % colors.length],
      } as React.CSSProperties,
    };
  });
}

export default function LoginView({ onLogin }: Props) {
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rainDrops, setRainDrops] = useState<ReturnType<typeof buildRainDrops>>([]);

  useEffect(() => {
    setRainDrops(buildRainDrops());
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = (form.elements.namedItem('login-user') as HTMLInputElement).value;
    const password = (form.elements.namedItem('login-pass') as HTMLInputElement).value;
    setError(null);
    setLoading(true);
    const user = await signIn(username, password);
    setLoading(false);
    if (!user) {
      setError('Usuario o contraseña incorrectos. Revisa ambos e intenta de nuevo.');
      (form.elements.namedItem('login-pass') as HTMLInputElement).select();
    } else {
      form.reset();
      onLogin(user);
    }
  }

  return (
    <section className="login" aria-label="Iniciar sesión">
      <div className="rain" aria-hidden="true">
        {rainDrops.map((drop, i) => (
          <svg key={i} style={drop.style}><use href="#i-heart"/></svg>
        ))}
      </div>
      <div className="login-card">
        <svg className="kiss" viewBox="0 0 216 130" role="img" aria-label="Dos caritas dándose un beso">
          <g className="kiss-a"><use href="#face-a" x="0" y="10" width="120" height="120"/></g>
          <g className="kiss-b"><use href="#face-b" x="96" y="10" width="120" height="120"/></g>
          <g className="kiss-heart"><use href="#i-heart" x="96" y="0" width="24" height="24"/></g>
        </svg>
        <div>
          <h1>Fortachones</h1>
          <p className="login-sub">Nuestra casa, nuestras cuentas, nuestro nidito.</p>
        </div>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field">
            <label htmlFor="login-user">Usuario</label>
            <input id="login-user" name="login-user" type="text" required
              autoCapitalize="none" spellCheck={false} placeholder="fortachona o fortachon"/>
          </div>
          <div className="field">
            <label htmlFor="login-pass">Contraseña</label>
            <div className="pass-wrap">
              <input id="login-pass" name="login-pass" type={showPass ? 'text' : 'password'} required/>
              <button className="pass-toggle" type="button" aria-pressed={showPass}
                onClick={() => setShowPass(v => !v)}>
                {showPass ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </section>
  );
}
