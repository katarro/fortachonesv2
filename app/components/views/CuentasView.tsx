'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Account, Expense, User } from '../../lib/types';
import { Format } from '../../lib/format';
import { getAccounts, getExpenses } from '../../lib/services';
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
                  onClick={() => setModal({ accountId: account.id, month })} />
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
        onClose={() => setModal(null)}
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
      aria-label={`Actualizar la cuenta de ${account.name}: ${Format.money(Number(expense.amount))}`}
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
