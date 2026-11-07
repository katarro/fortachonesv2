'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Account, Expense, User } from '../../lib/types';
import { Format } from '../../lib/format';
import { getAccounts, getExpenses, deleteExpense } from '../../lib/services';
import ExpenseModal from '../ExpenseModal';

interface Props {
  user: User;
  allUsers: User[];
  isActive: boolean;
  showToast: (msg: string) => void;
}

interface ModalTarget { accountId: number; month: string }

export default function CuentasView({ user, allUsers, isActive, showToast }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalTarget | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const month = useMemo(() => Format.monthKey(new Date()), []);

  async function fetchData() {
    const [accs, exps] = await Promise.all([getAccounts(), getExpenses([month])]);
    setAccounts(accs);
    setExpenses(exps);
    setLoading(false);
  }

  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = accounts.filter(a => a.active);
  const total = expenses
    .filter(e => active.some(a => a.id === e.account_id))
    .reduce((s, e) => s + Number(e.amount), 0);

  function handleSaved() {
    const acc = accounts.find(a => a.id === modal?.accountId);
    const exp = expenses.find(e => e.account_id === modal?.accountId);
    const amount = exp ? `: ${Format.money(Number(exp.amount))}` : '';
    showToast(`${acc?.name ?? ''}${amount} guardado`);
    setModal(null);
    fetchData();
  }

  function handleDeleted() {
    const acc = accounts.find(a => a.id === modal?.accountId);
    showToast(`${acc?.name ?? 'Cuenta'} quitada`);
    setModal(null);
    fetchData();
  }

  if (loading) return <div className="gutter"><main className="inner single" /></div>;

  return (
    <>
      <section className="band gutter">
        <div className="inner">
          <div className="band-head">
            <div>
              <h1>Cuentas de {Format.monthName(month)}</h1>
              <p className="band-note">
                {active.filter(a => expenses.find(e => e.account_id === a.id)).length} de {active.length} subidas
                {' · '}Total {Format.money(total)}
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="gutter">
        <main className="inner single">
          <div className="bill-grid">
            {active.length === 0 ? (
              <p className="empty" style={{ gridColumn: '1/-1' }}>
                No hay cuentas activas. Actívalas o agrégalas en <a href="#mantenedor">Mantenedor</a>.
              </p>
            ) : active.map(account => {
              const expense = expenses.find(e => e.account_id === account.id);
              const author = expense ? allUsers.find(u => u.id === expense.author_id) : undefined;
              return (
                <BillCard key={account.id} account={account} expense={expense} author={author}
                  onClick={expense
                    ? () => setDetailId(account.id)
                    : () => setModal({ accountId: account.id, month })} />
              );
            })}
          </div>
        </main>
      </div>
      <ExpenseModal
        accountId={modal?.accountId ?? null}
        month={modal?.month ?? null}
        accounts={accounts}
        expenses={expenses}
        user={user}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onClose={() => setModal(null)}
      />
      <ExpenseDetailModal
        accountId={detailId}
        accounts={accounts}
        expenses={expenses}
        allUsers={allUsers}
        month={month}
        onEdit={id => { setDetailId(null); setModal({ accountId: id, month }); }}
        onDeleted={() => fetchData()}
        onClose={() => setDetailId(null)}
        showToast={showToast}
      />
    </>
  );
}

function BillCard({ account, expense, author, onClick }: {
  account: Account;
  expense: Expense | undefined;
  author: User | undefined;
  onClick: () => void;
}) {
  if (!expense) {
    return (
      <button className="bill" type="button" data-state="missing"
        aria-label={`Subir la cuenta de ${account.name}`} onClick={onClick}>
        <span className="bill-media">
          <svg className="icon" aria-hidden="true"><use href="#i-camera" /></svg>
        </span>
        <span className="bill-body">
          <span className="bill-name">{account.name}</span>
          <span className="bill-amount">Por subir</span>
          <span className="bill-by">Toca para subirla</span>
        </span>
      </button>
    );
  }
  return (
    <button className="bill" type="button" data-state="done"
      aria-label={`Ver la cuenta de ${account.name}: ${Format.money(Number(expense.amount))}`}
      onClick={onClick}>
      <span className="bill-media" data-user={!expense.photo_url ? author?.username : undefined}>
        {expense.photo_url
          ? <img src={expense.photo_url} alt="" />
          : <svg className="fill" aria-hidden="true"><use href="#i-heart" /></svg>}
      </span>
      <span className="bill-body">
        <span className="bill-name">
          <svg className="icon" aria-hidden="true"><use href="#i-check" /></svg>
          {account.name}
        </span>
        <span className="bill-amount">{Format.money(Number(expense.amount))}</span>
        <span className="bill-by">
          {author && (
            <svg className="avatar" data-user={author.username} viewBox="0 0 120 120" aria-hidden="true">
              <use href={`#${author.face}`} />
            </svg>
          )}
          <span>Subida por <b>{author?.display_name}</b> · {Format.dayMonth(expense.date)}</span>
        </span>
      </span>
    </button>
  );
}

/* ---- ExpenseDetailModal ---- */
function ExpenseDetailModal({ accountId, accounts, expenses, allUsers, month, onEdit, onDeleted, onClose, showToast }: {
  accountId: number | null;
  accounts: Account[];
  expenses: Expense[];
  allUsers: User[];
  month: string;
  onEdit: (accountId: number) => void;
  onDeleted: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const account = accountId !== null ? accounts.find(a => a.id === accountId) : undefined;
  const expense = accountId !== null ? expenses.find(e => e.account_id === accountId) : undefined;
  const author = expense ? allUsers.find(u => u.id === expense.author_id) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (accountId !== null) {
      setConfirming(false);
      dialog.showModal();
      dialog.scrollTop = 0;
    } else if (dialog.open) {
      dialog.close();
    }
  }, [accountId]);

  async function handleDelete() {
    if (!expense || !account) return;
    await deleteExpense(expense.id);
    dialogRef.current?.close();
    showToast(`${account.name} quitada`);
    onDeleted();
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="expense-detail-title"
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
      <div className="detail">
        <div className="detail-head">
          <h2 id="expense-detail-title">{account?.name}</h2>
          <button className="icon-btn" type="button" aria-label="Cerrar"
            onClick={() => dialogRef.current?.close()}>
            <svg className="icon"><use href="#i-close" /></svg>
          </button>
        </div>
        {expense && (
          <>
            <div className="detail-media" data-user={!expense.photo_url ? author?.username : undefined}>
              {expense.photo_url
                ? <img src={expense.photo_url} alt={account?.name} />
                : <svg aria-hidden="true"><use href="#i-heart" /></svg>}
            </div>
            <p className="detail-desc">{Format.money(Number(expense.amount))}</p>
            <div className="detail-meta">
              <span className="detail-by">
                {author && (
                  <svg className="avatar" data-user={author.username} viewBox="0 0 120 120" aria-hidden="true">
                    <use href={`#${author.face}`} />
                  </svg>
                )}
                <span>Subida por <b>{author?.display_name}</b> · {Format.dayMonth(expense.date)}</span>
              </span>
              <span className="detail-status" data-done={true}>
                <svg className="icon" aria-hidden="true"><use href="#i-check" /></svg>
                {Format.capital(Format.monthLong(month))}
              </span>
            </div>
            {!confirming ? (
              <div className="detail-actions">
                <button className="btn btn-danger" type="button" onClick={() => setConfirming(true)}>Borrar</button>
                <button className="btn" type="button" onClick={() => { dialogRef.current?.close(); onEdit(expense.account_id); }}>Editar</button>
              </div>
            ) : (
              <div className="detail-actions">
                <p className="confirm-text" style={{ flex: '1 1 100%' }}>¿Quitar esta cuenta? No se puede deshacer.</p>
                <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>No, conservar</button>
                <button className="btn" type="button" onClick={handleDelete}>Sí, quitar</button>
              </div>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
