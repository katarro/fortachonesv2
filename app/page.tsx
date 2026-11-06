'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from './lib/types';
import { type Route, ROUTES } from './lib/types';
import { restoreSession, getAllProfiles, signOut } from './lib/services';
import { Format } from './lib/format';
import IconSprite from './components/IconSprite';
import LoginView from './components/LoginView';
import AppShell from './components/AppShell';
import CuentasView from './components/views/CuentasView';
import HistoricoView from './components/views/HistoricoView';
import MantenedorView from './components/views/MantenedorView';
import NiditoView from './components/views/NiditoView';
import SuperduperView from './components/views/SuperduperView';

export default function FortachonesApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [route, setRoute] = useState<Route>('cuentas');
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const [notifKey, setNotifKey] = useState(0);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);

  // Restore session on mount
  useEffect(() => {
    restoreSession().then(async profile => {
      if (profile) {
        setUser(profile);
        const profiles = await getAllProfiles();
        setAllUsers(profiles);
      }
      setLoading(false);
    });
  }, []);

  // Hash-based routing
  useEffect(() => {
    const sync = () => {
      const hash = location.hash.slice(1) as Route;
      setRoute(ROUTES.includes(hash) ? hash : 'cuentas');
    };
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // Toast
  const showToast = useCallback((msg: string) => {
    setToast({ msg, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast?.key]); // eslint-disable-line

  // Show toast on login
  async function handleLogin(profile: User) {
    const profiles = await getAllProfiles();
    setAllUsers(profiles);
    setUser(profile);
    // notifications loaded in AppShell via notifKey — trigger refresh
    setNotifKey(k => k + 1);
    showToast(`Hola, ${profile.display_name}`);
  }

  function navigate(r: Route) {
    location.hash = r;
    setRoute(r);
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    setAllUsers([]);
  }

  function handleOpenTask(taskId: number) {
    navigate('nidito');
    setOpenTaskId(taskId);
  }

  if (loading) return null;

  if (!user) {
    return (
      <>
        <IconSprite />
        <LoginView onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <IconSprite />
      <AppShell
        user={user}
        allUsers={allUsers}
        route={route}
        notifKey={notifKey}
        onNavigate={navigate}
        onLogout={handleLogout}
        onOpenTask={handleOpenTask}
        showToast={showToast}
      >
        {ROUTES.map(r => (
          <div key={r} id={`view-${r}`} hidden={r !== route}>
            {r === 'cuentas' && (
              <CuentasView user={user} allUsers={allUsers} isActive={route === 'cuentas'} showToast={showToast} />
            )}
            {r === 'historico' && (
              <HistoricoView user={user} allUsers={allUsers} isActive={route === 'historico'} showToast={showToast} />
            )}
            {r === 'mantenedor' && (
              <MantenedorView isActive={route === 'mantenedor'} showToast={showToast} />
            )}
            {r === 'nidito' && (
              <NiditoView
                user={user} allUsers={allUsers} isActive={route === 'nidito'}
                initialOpenTaskId={openTaskId} onTaskOpened={() => setOpenTaskId(null)}
                onNotifChange={() => setNotifKey(k => k + 1)}
                showToast={showToast}
              />
            )}
            {r === 'superduper' && (
              <SuperduperView user={user} allUsers={allUsers} isActive={route === 'superduper'} showToast={showToast} />
            )}
          </div>
        ))}
      </AppShell>

      {toast && (
        <div className="toast" role="status" aria-live="polite">{toast.msg}</div>
      )}
    </>
  );
}
