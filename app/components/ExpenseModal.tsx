'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Account, Expense, User } from '../lib/types';
import { Format, getMonthDateRange } from '../lib/format';
import { upsertExpense, deleteExpense } from '../lib/services';
import PhotoField, { type PhotoFieldRef } from './PhotoField';

interface Props {
  accountId: number | null;
  month: string | null;
  accounts: Account[];
  expenses: Expense[];
  user: User;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

export default function ExpenseModal({ accountId, month, accounts, expenses, user, onSaved, onDeleted, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photoRef = useRef<PhotoFieldRef>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isOpen = accountId !== null && month !== null;
  const account = accounts.find(a => a.id === accountId);
  const existing = isOpen ? expenses.find(e => e.account_id === accountId && e.month === month) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setConfirming(false);
      dialog.showModal();
      const { min, max } = getMonthDateRange(month!);
      if (amountRef.current) amountRef.current.value = existing ? String(existing.amount) : '';
      if (dateRef.current) {
        dateRef.current.min = min;
        dateRef.current.max = max;
        dateRef.current.value = existing ? existing.date : max;
      }
      photoRef.current?.set(existing?.photo_url ?? null);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, existing, month]);

  const handleClose = useCallback(() => {
    photoRef.current?.reset();
    onClose();
  }, [onClose]);

  async function handleDelete() {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteExpense(existing.id);
      dialogRef.current?.close();
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !month || saving) return;
    setSaving(true);
    try {
      const amount = Number(amountRef.current?.value);
      const date = dateRef.current?.value ?? '';
      await upsertExpense({
        accountId,
        month,
        amount,
        date,
        photoUrl: photoRef.current?.value ?? null,
        authorId: user.id,
        existingId: existing?.id,
      });
      dialogRef.current?.close();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!account || !month) return null;

  return (
    <dialog ref={dialogRef} aria-labelledby="modal-title" onClose={handleClose}
      onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="modal-title">{existing ? 'Actualizar' : 'Subir'} {account.name}</h2>
          <p className="hint" id="modal-month">{Format.capital(Format.monthLong(month))}</p>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="exp-amount">Monto (CLP)</label>
            <input ref={amountRef} id="exp-amount" type="number" min={1} step={1}
              inputMode="numeric" placeholder="38990" required />
          </div>
          <div className="field">
            <label htmlFor="exp-date">Fecha</label>
            <input ref={dateRef} id="exp-date" type="date" required />
          </div>
        </div>
        <div className="field">
          <span className="label">Foto de la boleta <span className="hint">(opcional)</span></span>
          <PhotoField ref={photoRef} inputId="exp-photo-input" />
        </div>
        <div className="as-user">
          <svg className="avatar" data-user={user.username} viewBox="0 0 120 120" aria-hidden="true">
            <use href={`#${user.face}`} />
          </svg>
          <span>Se guardará a nombre de {user.display_name}</span>
        </div>
        {confirming ? (
          <div className="modal-actions">
            <p className="confirm-text" style={{ flex: '1 1 100%' }}>¿Quitar esta cuenta? No se puede deshacer.</p>
            <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => setConfirming(false)}>No, conservar</button>
            <button className="btn btn-danger" type="button" disabled={saving} onClick={handleDelete}>{saving ? 'Quitando…' : 'Sí, quitar'}</button>
          </div>
        ) : (
          <div className="modal-actions">
            {existing && (
              <button className="btn btn-danger" type="button" disabled={saving} onClick={() => setConfirming(true)}>Quitar cuenta</button>
            )}
            <button className="btn btn-ghost" type="button" disabled={saving}
              onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cuenta'}</button>
          </div>
        )}
      </form>
    </dialog>
  );
}
