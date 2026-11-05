'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Account, Expense, User } from '../../lib/types';
import { Format, lastMonths } from '../../lib/format';
import { getAccounts, getExpenses } from '../../lib/services';
import ExpenseModal from '../ExpenseModal';

const CHART_MONTHS = 6;

interface Props {
  user: User;
  allUsers: User[];
  isActive: boolean;
  showToast: (msg: string) => void;
}

interface ModalTarget { accountId: number; month: string }

export default function HistoricoView({ user, allUsers, isActive, showToast }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalTarget | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const months = lastMonths(CHART_MONTHS);
    return months[months.length - 2];
  });
  const [showAll, setShowAll] = useState(false);

  const chartMonths = useMemo(() => lastMonths(CHART_MONTHS), []);

  async function fetchData() {
    const [accs, exps] = await Promise.all([getAccounts(), getExpenses()]);
    setAccounts(accs);
    setExpenses(exps);
    setLoading(false);
  }

  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = accounts.filter(a => a.active);

  const pickableMonths = useMemo(() => {
    const fromExpenses = expenses.map(e => e.month);
    return [...new Set([Format.monthKey(new Date()), ...fromExpenses])].sort().reverse();
  }, [expenses]);

  // Reset category if account was deactivated/removed
  const validCategory = active.some(a => String(a.id) === category) ? category : 'all';

  const shownAccounts = validCategory === 'all'
    ? active
    : active.filter(a => String(a.id) === validCategory);
  const shownIds = shownAccounts.map(a => a.id);

  const chosenMonths = showAll ? pickableMonths : [currentMonth];

  const totalFor = (m: string, ids: number[]) =>
    expenses
      .filter(e => e.month === m && ids.includes(e.account_id))
      .reduce((s, e) => s + Number(e.amount), 0);

  const chartTotals = chartMonths.map(m => ({ month: m, total: totalFor(m, shownIds) }));
  const max = Math.max(...chartTotals.map(t => t.total), 1);
  const peak = chartTotals.reduce((p, t) => t.total > p.total ? t : p, chartTotals[0]);
  const withData = chartTotals.filter(t => t.total > 0);
  const average = withData.length ? withData.reduce((s, t) => s + t.total, 0) / withData.length : 0;
  const currentKey = chartMonths[chartMonths.length - 1];

  const uploadedCount = chosenMonths.reduce(
    (n, m) => n + shownAccounts.filter(a => expenses.find(e => e.account_id === a.id && e.month === m)).length,
    0
  );

  const monthIndex = pickableMonths.indexOf(currentMonth);

  function step(offset: number) {
    const next = pickableMonths[monthIndex + offset];
    if (next) { setCurrentMonth(next); setShowAll(false); }
  }

  function handleSaved() {
    showToast('Guardado');
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
              <h1>Histórico</h1>
              <p className="band-note" id="history-note">
                {uploadedCount} de {shownAccounts.length * chosenMonths.length} cuentas subidas
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="gutter">
        <main className="inner single">
          {/* Bar chart */}
          <section className="panel" aria-labelledby="chart-title">
            <div className="panel-head">
              <h2 id="chart-title">Evolución de los gastos</h2>
              <span className="hint">Últimos 6 meses. Toca una barra para ver ese mes.</span>
            </div>
            {/* Category filter */}
            <div className="chips" id="category-filter" role="group" aria-label="Filtrar por cuenta">
              {[{ value: 'all', label: 'Todas' }, ...active.map(a => ({ value: String(a.id), label: a.name }))]
                .map(({ value, label }) => (
                  <button key={value} className="chip" type="button"
                    aria-pressed={validCategory === value}
                    onClick={() => setCategory(value)}>
                    {label}
                  </button>
                ))}
            </div>
            {/* Chart bars */}
            <div className="chart" id="chart">
              {chartTotals.map(({ month, total }) => {
                const height = (total / max) * 84;
                const showLabel = total > 0 && (month === currentKey || month === peak?.month);
                return (
                  <button key={month} className="bar-col" type="button"
                    data-current={month === currentKey}
                    aria-pressed={!showAll && month === currentMonth}
                    aria-label={`${Format.monthLong(month)}: ${Format.money(total)}`}
                    title={Format.money(total)}
                    onClick={() => { setCurrentMonth(month); setShowAll(false); }}>
                    <span className="bar-track">
                      <span className="bar" style={{ height: `${height.toFixed(1)}%` }} />
                      <span className="bar-value" data-label={showLabel || undefined}
                        style={{ bottom: `calc(${height.toFixed(1)}% + 5px)` }}>
                        {Format.compact(total)}
                      </span>
                    </span>
                    <span className="bar-month">{Format.monthShort(month)}</span>
                  </button>
                );
              })}
            </div>
            <p className="chart-note" id="chart-note">
              {withData.length
                ? `Mes más alto: ${Format.monthName(peak.month)}, ${Format.money(peak.total)}. Promedio: ${Format.money(Math.round(average))}. El mes actual va en rojo.`
                : 'Todavía no hay cuentas subidas en los últimos 6 meses.'}
            </p>
          </section>

          {/* Month picker */}
          <div className="field">
            <span className="filter-label" id="months-label">Meses que quieres ver</span>
            <div className="month-nav" id="month-picker" role="group" aria-labelledby="months-label">
              <button className="chip" type="button" aria-pressed={showAll}
                onClick={() => setShowAll(v => !v)}>
                Todos
              </button>
              <div className="month-step">
                <button className="icon-btn" type="button" aria-label="Mes anterior"
                  disabled={monthIndex >= pickableMonths.length - 1} onClick={() => step(1)}>
                  <svg className="icon"><use href="#i-left" /></svg>
                </button>
                <span className="month-now" aria-live="polite">
                  {showAll ? 'Todos los meses' : Format.capital(Format.monthLong(currentMonth))}
                </span>
                <button className="icon-btn" type="button" aria-label="Mes siguiente"
                  disabled={monthIndex <= 0} onClick={() => step(-1)}>
                  <svg className="icon"><use href="#i-right" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* History list */}
          <div className="stack" id="history">
            {active.length === 0 ? (
              <p className="empty" style={{ gridColumn: '1/-1' }}>
                No hay cuentas activas. Actívalas o agrégalas en <a href="#mantenedor">Mantenedor</a>.
              </p>
            ) : chosenMonths.map(m => (
              <section key={m} className="month-section">
                <div className="month-head">
                  <span>{Format.monthLong(m)}</span>
                  <span>{Format.money(totalFor(m, shownIds))}</span>
                </div>
                <div className="bill-grid">
                  {shownAccounts.map(account => {
                    const expense = expenses.find(e => e.account_id === account.id && e.month === m);
                    const author = expense ? allUsers.find(u => u.id === expense.author_id) : undefined;
                    return (
                      <HistBillCard key={account.id} account={account} expense={expense} author={author}
                        onClick={() => setModal({ accountId: account.id, month: m })} />
                    );
                  })}
                </div>
              </section>
            ))}
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

function HistBillCard({ account, expense, author, onClick }: {
  account: Account; expense: Expense | undefined; author: User | undefined; onClick: () => void;
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
      aria-label={`Actualizar ${account.name}: ${Format.money(Number(expense.amount))}`}
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
