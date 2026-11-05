'use client';

import { useState, useEffect, useRef } from 'react';
import type { Account } from '../../lib/types';
import { getAccounts, getExpenseAccountIds, addAccount, updateAccount, deleteAccount } from '../../lib/services';

interface Props {
  isActive: boolean;
  showToast: (msg: string) => void;
}

export default function MantenedorView({ isActive, showToast }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expCountMap, setExpCountMap] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function fetchData() {
    const [accs, expIds] = await Promise.all([getAccounts(), getExpenseAccountIds()]);
    const countMap = new Map<number, number>();
    expIds.forEach(({ account_id }) => countMap.set(account_id, (countMap.get(account_id) ?? 0) + 1));
    setAccounts(accs);
    setExpCountMap(countMap);
    setLoading(false);
  }

  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = nameInputRef.current?.value ?? '';
    if (!name.trim()) return;
    const result = await addAccount(name);
    if ('error' in result) { setAddError(result.error); return; }
    setAddError(null);
    if (nameInputRef.current) nameInputRef.current.value = '';
    showToast(`${result.account.name} agregada a las cuentas`);
    fetchData();
  }

  async function handleToggle(id: number, active: boolean) {
    const updated = await updateAccount(id, { active });
    if (updated) showToast(`${updated.name} ${updated.active ? 'activada' : 'desactivada'}`);
    fetchData();
  }

  async function handleRename(id: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = accounts.find(a => a.id === id);
    if (current?.name === trimmed) return;
    const updated = await updateAccount(id, { name: trimmed });
    if (!updated) {
      showToast(`Ya existe una cuenta llamada "${trimmed}".`);
      fetchData();
    } else {
      showToast(`Nombre cambiado a ${updated.name}`);
    }
  }

  async function handleDelete(id: number) {
    const acc = accounts.find(a => a.id === id);
    await deleteAccount(id);
    showToast(`${acc?.name ?? ''} eliminada`);
    fetchData();
  }

  const activeCount = accounts.filter(a => a.active).length;

  if (loading) return <div className="gutter"><main className="inner single" /></div>;

  return (
    <>
      <section className="band gutter">
        <div className="inner">
          <div className="band-head">
            <div>
              <h1>Mantenedor de cuentas</h1>
              <p className="band-note">{activeCount} de {accounts.length} activas</p>
            </div>
          </div>
        </div>
      </section>
      <div className="gutter">
        <main className="inner single">
          <section className="panel narrow" aria-labelledby="accounts-add-title">
            <h2 id="accounts-add-title">Agregar una cuenta</h2>
            <form className="account-add" onSubmit={handleAdd}>
              <div className="field">
                <label htmlFor="account-name">Nombre</label>
                <input ref={nameInputRef} id="account-name" type="text" maxLength={40}
                  required placeholder="Estacionamiento" />
              </div>
              <button className="btn" type="submit">Agregar</button>
            </form>
            {addError && <p className="form-error" role="alert">{addError}</p>}
          </section>

          <section className="panel narrow" aria-labelledby="accounts-title">
            <div className="panel-head">
              <h2 id="accounts-title">Cuentas del hogar</h2>
              <span className="hint">Solo las activas aparecen en Cuentas e Histórico.</span>
            </div>
            <div className="account-list">
              {accounts.map(account => {
                const count = expCountMap.get(account.id) ?? 0;
                const usage = count === 1 ? '1 registro' : `${count} registros`;
                return (
                  <div key={account.id} className="account-row">
                    <label className="switch">
                      <input type="checkbox" id={`acct-on-${account.id}`} checked={account.active}
                        aria-label={`Activar ${account.name}`}
                        onChange={e => handleToggle(account.id, e.target.checked)} />
                      <span />
                    </label>
                    <input type="text" id={`acct-name-${account.id}`} defaultValue={account.name}
                      maxLength={40} aria-label={`Nombre de la cuenta ${account.name}`}
                      onBlur={e => handleRename(account.id, e.currentTarget.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                    <div className="account-meta">
                      <span>{usage}</span>
                      {count === 0 && (
                        <button className="account-delete" type="button"
                          onClick={() => handleDelete(account.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
