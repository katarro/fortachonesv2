'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Notification, User } from '../lib/types';
import { type Route, ROUTES } from '../lib/types';
import { Format } from '../lib/format';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/services';

interface Props {
  user: User;
  allUsers: User[];
  route: Route;
  notifKey: number;
  onNavigate: (r: Route) => void;
  onLogout: () => void;
  onOpenTask: (taskId: number) => void;
  showToast: (msg: string) => void;
  children: React.ReactNode;
}

export default function AppShell({ user, allUsers, route, notifKey, onNavigate, onLogout, onOpenTask, showToast, children }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [goodbyeOpen, setGoodbyeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const viewsRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef(route);
  const notifDialogRef = useRef<HTMLDialogElement>(null);
  const goodbyeDialogRef = useRef<HTMLDialogElement>(null);
  const navDialogRef = useRef<HTMLDialogElement>(null);

  // Theme init
  useEffect(() => {
    const saved = localStorage.getItem('fortachones-tema');
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, []);

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      localStorage.setItem('fortachones-tema', next ? 'dark' : 'light');
      return next;
    });
  }

  // Notifications
  async function fetchNotifs() {
    const data = await getNotifications(user.id);
    setNotifications(data);
  }
  useEffect(() => { fetchNotifs(); }, [notifKey]); // eslint-disable-line

  const unreadCount = notifications.filter(n => !n.read).length;

  // Dialogs
  useEffect(() => {
    const d = notifDialogRef.current;
    if (!d) return;
    if (notifOpen && !d.open) d.showModal();
    else if (!notifOpen && d.open) d.close();
  }, [notifOpen]);

  useEffect(() => {
    const d = goodbyeDialogRef.current;
    if (!d) return;
    if (goodbyeOpen && !d.open) d.showModal();
    else if (!goodbyeOpen && d.open) d.close();
  }, [goodbyeOpen]);

  // Update routeRef for swipe
  useEffect(() => { routeRef.current = route; }, [route]);

  // Swipe navigation
  useEffect(() => {
    const container = viewsRef.current;
    if (!container) return;
    const MOUSE_IGNORE = 'input, textarea, select, .switch';
    const START = 10;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let gesture: { id: number; x: number; y: number; t: number; dx: number; dragging: boolean; peerEl: HTMLElement | null; peerRoute: Route | null } | null = null;
    let animating = false;
    let swallowClick = false;

    const getEl = (r: Route) => container.querySelector<HTMLElement>(`#view-${r}`);

    const prepare = (r: Route) => {
      const el = getEl(r);
      if (!el) return null;
      const top = Math.max(0, window.scrollY - (container.getBoundingClientRect().top + window.scrollY));
      el.classList.add('swipe-peer');
      (el as HTMLElement).style.top = `${top}px`;
      el.hidden = false;
      return el;
    };

    const releasePeer = (el: HTMLElement) => {
      el.classList.remove('swipe-peer', 'swipe-anim');
      el.style.transform = '';
      el.style.top = '';
      el.hidden = true;
    };

    const onDown = (e: PointerEvent) => {
      if (animating || !e.isPrimary || e.button !== 0) return;
      if (e.pointerType === 'mouse' && (e.target as Element).closest(MOUSE_IGNORE)) return;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dragging: false, peerEl: null, peerRoute: null };
      if (e.pointerType === 'mouse') container.classList.add('mouse-down');
    };

    const onMove = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.abs(dy) > START && Math.abs(dy) >= Math.abs(dx)) { gesture = null; container.classList.remove('mouse-down', 'dragging'); return; }
        if (Math.abs(dx) <= START || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        gesture.dragging = true;
        container.setPointerCapture(gesture.id);
        container.classList.add('dragging');
      }
      gesture.dx = dx;
      const idx = ROUTES.indexOf(routeRef.current);
      const peerRoute = dx < 0 ? (ROUTES[idx + 1] ?? null) : (ROUTES[idx - 1] ?? null);
      if (peerRoute !== gesture.peerRoute) {
        if (gesture.peerEl) releasePeer(gesture.peerEl);
        gesture.peerRoute = peerRoute;
        gesture.peerEl = peerRoute ? prepare(peerRoute) : null;
      }
      const active = getEl(routeRef.current);
      const width = container.clientWidth;
      const shift = gesture.peerEl ? dx : dx * 0.25;
      if (active) active.style.transform = `translateX(${shift}px)`;
      if (gesture.peerEl) gesture.peerEl.style.transform = `translateX(${shift + (dx < 0 ? width : -width)}px)`;
    };

    const settle = (go: boolean) => {
      if (!gesture) return;
      const g = gesture;
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 60);
      const active = getEl(routeRef.current);
      const width = container.clientWidth;
      const finish = () => {
        if (go && g.peerRoute) onNavigate(g.peerRoute);
        if (active) { active.classList.remove('swipe-anim'); active.style.transform = ''; }
        if (g.peerEl) {
          g.peerEl.classList.remove('swipe-peer', 'swipe-anim');
          g.peerEl.style.transform = '';
          g.peerEl.style.top = '';
          if (!go) g.peerEl.hidden = true;
        }
        animating = false;
      };
      gesture = null;
      container.classList.remove('mouse-down', 'dragging');
      animating = true;
      if (reduced.matches) { finish(); return; }
      if (active) active.classList.add('swipe-anim');
      if (g.peerEl) g.peerEl.classList.add('swipe-anim');
      const dir = g.dx < 0 ? -1 : 1;
      if (active) active.style.transform = go ? `translateX(${dir * width}px)` : '';
      if (g.peerEl) g.peerEl.style.transform = go ? 'translateX(0)' : `translateX(${-dir * width}px)`;
      setTimeout(finish, 230);
    };

    const onUp = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      if (!gesture.dragging) { gesture = null; container.classList.remove('mouse-down', 'dragging'); return; }
      const speed = Math.abs(gesture.dx) / Math.max(1, e.timeStamp - gesture.t);
      const go = !!gesture.peerEl && (Math.abs(gesture.dx) > container.clientWidth * 0.22 || (speed > 0.5 && Math.abs(gesture.dx) > 30));
      settle(go);
    };

    const onClickCapture = (e: MouseEvent) => {
      if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; }
    };

    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', () => { if (gesture?.dragging) settle(false); else { gesture = null; container.classList.remove('mouse-down', 'dragging'); } });
    container.addEventListener('click', onClickCapture, true);
    return () => {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('click', onClickCapture, true);
    };
  }, [onNavigate]); // eslint-disable-line

  async function handleNotifClick(notif: Notification) {
    await markNotificationRead(notif.id);
    setNotifOpen(false);
    if (notif.task_id) onOpenTask(notif.task_id);
    fetchNotifs();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(user.id);
    fetchNotifs();
  }

  const partner = allUsers.find(u => u.id !== user.id);
  const bellLabel = unreadCount === 1 ? 'Notificaciones, 1 sin leer' : `Notificaciones, ${unreadCount} sin leer`;

  return (
    <>
      <header className="topbar gutter">
        <div className="inner">
          <button className="icon-btn" type="button" aria-label="Abrir menú"
            aria-haspopup="dialog" onClick={() => navDialogRef.current?.showModal()}>
            <svg className="icon"><use href="#i-menu"/></svg>
          </button>
          <div className="brand">
            <svg aria-hidden="true"><use href="#i-heart"/></svg>
            Fortachones
          </div>
          <div className="who">
            <button className="icon-btn bell" type="button" aria-haspopup="dialog"
              aria-label={bellLabel} onClick={() => setNotifOpen(true)}>
              <svg className="icon"><use href="#i-bell"/></svg>
              {unreadCount > 0 && (
                <span className="bell-badge" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <span>
              <svg className="avatar" data-user={user.username} viewBox="0 0 120 120" aria-hidden="true">
                <use href={`#${user.face}`}/>
              </svg>
            </span>
          </div>
          <div className="page-dots" aria-hidden="true">
            {ROUTES.map(r => <span key={r} className="page-dot" data-on={r === route} />)}
          </div>
        </div>
      </header>

      <div ref={viewsRef} id="views">
        {children}
      </div>

      {/* Nav drawer */}
      <dialog ref={navDialogRef} aria-label="Menú de navegación"
        onClick={e => { if ((e.target as Element) === e.currentTarget || (e.target as Element).closest('[data-tab], #logout-btn')) navDialogRef.current?.close(); }}>
        <div className="drawer">
          <div className="drawer-head">
            <div className="brand"><svg aria-hidden="true"><use href="#i-heart"/></svg>Fortachones</div>
            <button className="icon-btn" type="button" aria-label="Cerrar menú"
              onClick={() => navDialogRef.current?.close()}>
              <svg className="icon"><use href="#i-close"/></svg>
            </button>
          </div>
          <div className="drawer-user">
            <svg className="avatar" data-user={user.username} viewBox="0 0 120 120" aria-hidden="true">
              <use href={`#${user.face}`}/>
            </svg>
            <span>{user.display_name}</span>
          </div>
          <nav className="drawer-nav" aria-label="Secciones">
            {([['mantenedor','Mantenedor'],['historico','Histórico'],['cuentas','Cuentas'],['nidito','Nidito de amor'],['superduper','Super duper']] as [Route,string][]).map(([r,label]) => (
              <a key={r} href={`#${r}`} data-tab={r} aria-current={route === r ? 'page' : undefined}
                onClick={() => onNavigate(r)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="drawer-foot">
            <button className="drawer-action" type="button" onClick={toggleTheme}>
              <svg className="icon" aria-hidden="true"><use href={isDark ? '#i-sun' : '#i-moon'}/></svg>
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <button className="drawer-action" type="button" id="logout-btn"
              onClick={() => setGoodbyeOpen(true)}>
              <svg className="icon"><use href="#i-exit"/></svg>
              Salir
            </button>
          </div>
        </div>
      </dialog>

      {/* Theme toggle floating */}
      <button className="icon-btn theme-float" type="button" aria-label="Cambiar entre modo claro y oscuro"
        onClick={toggleTheme}>
        <svg className="icon" aria-hidden="true"><use href={isDark ? '#i-sun' : '#i-moon'}/></svg>
      </button>

      {/* Notifications dialog */}
      <dialog ref={notifDialogRef} aria-labelledby="notif-title" onClose={() => setNotifOpen(false)}
        onClick={e => { if (e.target === e.currentTarget) notifDialogRef.current?.close(); }}>
        <div className="notif-panel">
          <div className="notif-head">
            <h2 id="notif-title">Notificaciones</h2>
            <button className="icon-btn" type="button" aria-label="Cerrar"
              onClick={() => setNotifOpen(false)}>
              <svg className="icon"><use href="#i-close"/></svg>
            </button>
          </div>
          <ul className="notif-list">
            {notifications.length === 0
              ? <li className="empty">Sin notificaciones por ahora.</li>
              : notifications.map(n => {
                  const actor = allUsers.find(u => u.id === n.tasks?.author_id);
                  return (
                    <li key={n.id}>
                      <button className="notif-item" type="button" data-unread={!n.read}
                        onClick={() => handleNotifClick(n)}>
                        {actor && (
                          <svg className="avatar" data-user={actor.username} viewBox="0 0 120 120" aria-hidden="true">
                            <use href={`#${actor.face}`}/>
                          </svg>
                        )}
                        <span>
                          <span className="notif-text">{actor?.display_name} agregó {n.tasks?.title}</span>
                          <span className="notif-meta">Nidito de amor · {n.tasks?.date ? Format.dayMonth(n.tasks.date) : ''}</span>
                        </span>
                        {!n.read && <span className="notif-dot" title="Sin leer" />}
                      </button>
                    </li>
                  );
                })}
          </ul>
          {notifications.some(n => !n.read) && (
            <button className="chip notif-read-all" type="button" onClick={handleMarkAllRead}>
              Marcar todas como leídas
            </button>
          )}
        </div>
      </dialog>

      {/* Goodbye dialog */}
      <dialog ref={goodbyeDialogRef} aria-labelledby="goodbye-title" onClose={() => setGoodbyeOpen(false)}>
        <div className="goodbye">
          <div className="drops" aria-hidden="true">
            {Array.from({ length: 70 }, (_, i) => {
              const d = 0.7 + Math.random() * 0.8;
              return <i key={i} style={{ '--x': `${(Math.random()*100).toFixed(1)}%`, '--y': `${(Math.random()*95).toFixed(1)}%`, '--h': `${(14+Math.random()*16).toFixed(0)}px`, '--o': `${(0.25+Math.random()*0.4).toFixed(2)}`, '--d': `${d.toFixed(2)}s`, '--delay': `${(-Math.random()*d).toFixed(2)}s` } as React.CSSProperties} />
            })}
          </div>
          <div className="goodbye-box">
            {partner && <SadFace user={partner} />}
            <h2 id="goodbye-title">No me dejes... Yo Te Amo</h2>
            <div className="goodbye-actions">
              <button className="btn btn-ghost" type="button" onClick={onLogout}>Salir igual</button>
              <button className="btn" type="button" autoFocus
                onClick={() => { setGoodbyeOpen(false); showToast('Sabía que te quedarías'); }}>
                Me quedo contigo
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

function SadFace({ user }: { user: User }) {
  const isFortachona = user.username === 'fortachona';
  const skin = isFortachona ? 'var(--skin-a)' : 'var(--skin-b)';
  const ink = isFortachona ? 'var(--hair-a)' : 'var(--hair-b)';
  return (
    <svg className="goodbye-face" viewBox="0 0 200 200" role="img" aria-label={`Cara triste de ${user.display_name}`}>
      {isFortachona && <path fill={ink} d="M100 20C50 20 18 60 20 110c1 30-6 50-10 70 20 10 40 6 52-6h76c12 12 32 16 52 6-4-20-11-40-10-70 2-50-30-90-80-90z"/>}
      <circle cx="100" cy="105" r="72" fill={skin}/>
      <path fill={ink} d={isFortachona
        ? 'M30 98C34 56 62 32 100 32s66 24 70 66c-20-18-44-26-70-26s-50 8-70 26z'
        : 'M26 100C20 50 58 22 100 22s80 28 74 78c-14-16-40-28-74-28s-60 12-74 28z'}/>
      <path d="M58 92l28-13M142 92l-28-13" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round"/>
      <circle cx="74" cy="108" r="7.5" fill={ink}/>
      <circle cx="126" cy="108" r="7.5" fill={ink}/>
      <path d="M76 156q24-24 48 0" fill="none" stroke="var(--lip)" strokeWidth="6" strokeLinecap="round"/>
      <path className="tear" d="M70 118c5 8 8 12 8 16a8 8 0 0 1-16 0c0-4 3-8 8-16z"/>
      <path className="tear tear-late" d="M130 118c5 8 8 12 8 16a8 8 0 0 1-16 0c0-4 3-8 8-16z"/>
    </svg>
  );
}
