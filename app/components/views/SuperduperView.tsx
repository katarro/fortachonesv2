'use client';

import { useState, useEffect, useRef } from 'react';
import type { ShoppingItem, User } from '../../lib/types';
import { getShoppingItems, addShoppingItem, toggleShoppingItem, updateShoppingItem, deleteShoppingItem, clearShoppingItems } from '../../lib/services';

interface Props { user: User; allUsers: User[]; isActive: boolean; showToast: (msg: string) => void; }

type Filter = 'all' | 'pending' | 'bought';
const SCOPES = [
  { value: 'bought' as const, label: 'Comprados', question: (n: number) => `lo comprado (${n})` },
  { value: 'pending' as const, label: 'Pendientes', question: (n: number) => `lo pendiente (${n})` },
  { value: 'all' as const, label: 'Todos', question: (n: number) => `todos los registros (${n})` },
];

export default function SuperduperView({ user, allUsers, isActive, showToast }: Props) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [editId, setEditId] = useState<number | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  // tap detector
  const tapPendingRef = useRef<number | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchData() {
    const data = await getShoppingItems();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { if (isActive) fetchData(); }, [isActive]); // eslint-disable-line

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = addInputRef.current?.value.trim() ?? '';
    if (!text) return;
    if (addInputRef.current) addInputRef.current.value = '';
    addInputRef.current?.focus();
    await addShoppingItem(text);
    fetchData();
  }

  function tap(id: number) {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapPendingRef.current === id) {
      tapPendingRef.current = null;
      setEditId(id);
      return;
    }
    if (tapPendingRef.current !== null) handleToggle(tapPendingRef.current);
    tapPendingRef.current = id;
    tapTimerRef.current = setTimeout(() => { tapPendingRef.current = null; handleToggle(id); }, 260);
  }

  async function handleToggle(id: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    await toggleShoppingItem(id, item.bought_by_id ? null : user.id);
    fetchData();
  }

  const visible = items.filter(i =>
    filter === 'all' ? true : filter === 'bought' ? !!i.bought_by_id : !i.bought_by_id
  );
  const pending = items.filter(i => !i.bought_by_id).length;
  const bought = items.filter(i => !!i.bought_by_id).length;
  const EMPTY: Record<Filter, string> = {
    all: 'La lista está vacía. Escribe arriba la primera compra.',
    pending: 'No queda nada por comprar.',
    bought: 'Todavía no han comprado nada.',
  };

  if (loading) return <div className="gutter"><main className="inner single" /></div>;

  return (
    <>
      <section className="band gutter"><div className="inner"><div className="band-head"><div>
        <h1>Super duper</h1>
        <p className="band-note">{pending} por comprar · {bought} {bought === 1 ? 'comprado' : 'comprados'}</p>
      </div></div></div></section>
      <div className="gutter"><main className="inner single">
        <form className="shop-add" onSubmit={handleAdd}>
          <input ref={addInputRef} id="shop-input" type="text" maxLength={80} required
            placeholder="Agregar una compra" aria-label="Agregar una compra" autoComplete="off" />
          <button className="btn" type="submit">Agregar</button>
        </form>
        <div className="shop-tools">
          <div className="chips" id="shop-filter" role="group" aria-label="Filtrar la lista">
            {(['all','pending','bought'] as Filter[]).map(v => (
              <button key={v} className="chip" type="button" aria-pressed={filter === v}
                onClick={() => setFilter(v)}>
                {v === 'all' ? 'Todos' : v === 'pending' ? 'Pendientes' : 'Comprados'}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" type="button" disabled={items.length === 0}
            onClick={() => setClearOpen(true)}>Limpiar</button>
        </div>
        <section className="panel" aria-label="Lista de compras">
          <p className="hint shop-hint">Un toque marca como comprado. Dos toques abren editar o eliminar.</p>
          <ul className="shop-list">
            {visible.length === 0
              ? <li className="empty">{EMPTY[filter]}</li>
              : visible.map(item => {
                  const buyer = item.bought_by_id ? allUsers.find(u => u.id === item.bought_by_id) : undefined;
                  return (
                    <li key={item.id} className="shop-item">
                      <button className="shop-row" type="button" aria-pressed={!!item.bought_by_id}
                        aria-label={`${item.text}, ${item.bought_by_id ? `comprado por ${buyer?.display_name}` : 'pendiente'}`}
                        onClick={() => tap(item.id)}>
                        <span className="shop-mark"><svg className="icon" aria-hidden="true"><use href="#i-check"/></svg></span>
                        <span className="shop-text">{item.text}</span>
                        {buyer
                          ? <span className="shop-who" title={`Comprado por ${buyer.display_name}`}>
                              <svg className="avatar" data-user={buyer.username} viewBox="0 0 120 120" aria-hidden="true"><use href={`#${buyer.face}`}/></svg>
                            </span>
                          : <span />}
                      </button>
                    </li>
                  );
                })}
          </ul>
        </section>
      </main></div>

      {/* Edit modal */}
      {editId !== null && (
        <ShopEditModal id={editId} items={items} onSaved={() => { setEditId(null); fetchData(); }}
          onClose={() => setEditId(null)} showToast={showToast} />
      )}
      {/* Clear modal */}
      {clearOpen && (
        <ShopClearModal items={items} onCleared={() => { setClearOpen(false); fetchData(); }}
          onClose={() => setClearOpen(false)} showToast={showToast} />
      )}
    </>
  );
}

function ShopEditModal({ id, items, onSaved, onClose, showToast }: {
  id: number; items: ShoppingItem[]; onSaved: () => void; onClose: () => void; showToast: (m: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const item = items.find(i => i.id === id);

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    if (inputRef.current && item) inputRef.current.value = item.text;
    setConfirming(false);
  }, [id]); // eslint-disable-line

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const text = inputRef.current?.value.trim() ?? '';
    if (!text) return;
    await updateShoppingItem(id, text);
    dialogRef.current?.close();
    showToast('Compra actualizada');
    onSaved();
  }

  async function handleDelete() {
    await deleteShoppingItem(id);
    dialogRef.current?.close();
    showToast(`${item?.text ?? ''} eliminado`);
    onSaved();
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="shop-modal-title" onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
      <form className="modal-form" onSubmit={handleSave}>
        <h2 id="shop-modal-title" style={{ fontSize: '1.5rem', lineHeight: '1.2' }}>Editar compra</h2>
        <div className="field">
          <label htmlFor="shop-edit-text">Compra</label>
          <input ref={inputRef} id="shop-edit-text" type="text" maxLength={80} required autoComplete="off" />
        </div>
        {!confirming ? (
          <div className="modal-actions">
            <button className="btn btn-danger" type="button" onClick={() => setConfirming(true)}>Eliminar</button>
            <button className="btn btn-ghost" type="button" onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <button className="btn" type="submit">Guardar</button>
          </div>
        ) : (
          <div className="modal-actions">
            <p className="confirm-text" style={{ flex: '1 1 100%' }}>¿Eliminar este registro? No se puede deshacer.</p>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>No, conservar</button>
            <button className="btn" type="button" onClick={handleDelete}>Sí, eliminar</button>
          </div>
        )}
      </form>
    </dialog>
  );
}

function ShopClearModal({ items, onCleared, onClose, showToast }: {
  items: ShoppingItem[]; onCleared: () => void; onClose: () => void; showToast: (m: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState<'bought' | 'pending' | 'all'>('bought');
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const count = (s: 'bought'|'pending'|'all') =>
    items.filter(i => s === 'all' ? true : s === 'bought' ? !!i.bought_by_id : !i.bought_by_id).length;

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    const first = SCOPES.find(o => count(o.value) > 0);
    if (first) setScope(first.value);
    setStep('choose');
  }, []); // eslint-disable-line

  async function handleClear() {
    await clearShoppingItems(scope);
    dialogRef.current?.close();
    const n = count(scope);
    showToast(n === 1 ? 'Se limpió 1 registro' : `Se limpiaron ${n} registros`);
    onCleared();
  }

  const option = SCOPES.find(o => o.value === scope)!;

  return (
    <dialog ref={dialogRef} aria-labelledby="clear-title" onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
      <form className="modal-form" onSubmit={e => { e.preventDefault(); setStep('confirm'); }}>
        <h2 id="clear-title" style={{ fontSize: '1.5rem', lineHeight: '1.2' }}>Limpiar la lista</h2>
        {step === 'choose' ? (
          <>
            <fieldset className="choice-list">
              <legend className="hint" style={{ padding: '0 0 6px' }}>¿Qué quieres limpiar?</legend>
              {SCOPES.map(o => (
                <label key={o.value} className="choice">
                  <input type="radio" name="clear-scope" value={o.value} checked={scope === o.value}
                    disabled={count(o.value) === 0} onChange={() => setScope(o.value)} />
                  <span>{o.label}</span><span>{count(o.value)}</span>
                </label>
              ))}
            </fieldset>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => dialogRef.current?.close()}>Cancelar</button>
              <button className="btn" type="submit">Continuar</button>
            </div>
          </>
        ) : (
          <div className="modal-form" style={{ padding: 0 }}>
            <p className="confirm-text">
              ¿Seguro que quieres limpiar {option.question(count(scope))}? No se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setStep('choose')}>No, volver</button>
              <button className="btn" type="button" onClick={handleClear}>Sí, limpiar</button>
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}
