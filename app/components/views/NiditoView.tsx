'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task, User } from '../../lib/types';
import { Format } from '../../lib/format';
import { getTasks, addTask, updateTask, deleteTask, addNotification, deleteNotificationsForTask } from '../../lib/services';
import PhotoField, { type PhotoFieldRef } from '../PhotoField';

interface Props {
  user: User;
  allUsers: User[];
  isActive: boolean;
  initialOpenTaskId: number | null;
  onTaskOpened: () => void;
  onNotifChange: () => void;
  showToast: (msg: string) => void;
}

export default function NiditoView({ user, allUsers, isActive, initialOpenTaskId, onTaskOpened, onNotifChange, showToast }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskModalId, setTaskModalId] = useState<number | 'new' | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  async function fetchData() {
    const data = await getTasks();
    setTasks(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isActive && initialOpenTaskId !== null) {
      setDetailId(initialOpenTaskId);
      onTaskOpened();
    }
  }, [isActive, initialOpenTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const partner = allUsers.find(u => u.id !== user.id);

  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || b.id - a.id);
  const pending = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;

  async function handleTaskSaved(task: Task, isNew: boolean) {
    if (isNew && partner) await addNotification(partner.id, task.id);
    if (isNew) onNotifChange();
    fetchData();
  }

  async function handleTaskDeleted(taskId: number) {
    await deleteNotificationsForTask(taskId);
    onNotifChange();
    fetchData();
  }

  if (loading) return <div className="gutter"><main className="inner single" /></div>;

  return (
    <>
      <section className="band gutter">
        <div className="inner">
          <div className="band-head">
            <div>
              <h1>Nidito de amor</h1>
              <p className="band-note">{pending} por comprar · {done} {done === 1 ? 'comprado' : 'comprados'}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="gutter">
        <main className="inner single">
          <div className="bill-grid" id="task-grid">
            {/* Add new card */}
            <button className="bill" type="button" data-task="new" data-state="missing"
              aria-label="Agregar algo para comprar" onClick={() => setTaskModalId('new')}>
              <span className="bill-media">
                <svg className="icon" aria-hidden="true"><use href="#i-plus" /></svg>
              </span>
              <span className="bill-body">
                <span className="bill-amount">Algo nuevo</span>
                <span className="bill-by">Toca para agregarlo</span>
              </span>
            </button>
            {sorted.map(task => {
              const author = allUsers.find(u => u.id === task.author_id);
              return (
                <button key={task.id} className="bill" type="button"
                  data-state={task.done ? 'finished' : 'open'}
                  aria-label={`Abrir ${task.title}${task.done ? ', ya comprado' : ''}`}
                  onClick={() => setDetailId(task.id)}>
                  <span className="bill-media" data-user={!task.photo_url ? author?.username : undefined}>
                    {task.photo_url
                      ? <img src={task.photo_url} alt="" />
                      : <svg className="fill" aria-hidden="true"><use href="#i-heart" /></svg>}
                  </span>
                  <span className="bill-body">
                    <span className="bill-name">
                      {task.done && <svg className="icon" aria-hidden="true"><use href="#i-check" /></svg>}
                      <span>{task.title}</span>
                    </span>
                    <span className="bill-desc">{task.description}</span>
                    <span className="bill-by">
                      {author && (
                        <svg className="avatar" data-user={author.username} viewBox="0 0 120 120" aria-hidden="true">
                          <use href={`#${author.face}`} />
                        </svg>
                      )}
                      <span>Agregado por <b>{author?.display_name}</b> · {Format.dayMonth(task.date)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      </div>

      <TaskModal
        taskId={taskModalId}
        tasks={tasks}
        user={user}
        allUsers={allUsers}
        onSaved={handleTaskSaved}
        onClose={() => setTaskModalId(null)}
        showToast={showToast}
      />
      <TaskDetailModal
        taskId={detailId}
        tasks={tasks}
        allUsers={allUsers}
        onEdit={id => { setDetailId(null); setTaskModalId(id); }}
        onDeleted={handleTaskDeleted}
        onClose={() => setDetailId(null)}
        showToast={showToast}
      />
    </>
  );
}

/* ---- TaskModal ---- */
function TaskModal({ taskId, tasks, user, allUsers, onSaved, onClose, showToast }: {
  taskId: number | 'new' | null;
  tasks: Task[];
  user: User;
  allUsers: User[];
  onSaved: (task: Task, isNew: boolean) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photoRef = useRef<PhotoFieldRef>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const isOpen = taskId !== null;
  const isNew = taskId === 'new';
  const task = typeof taskId === 'number' ? tasks.find(t => t.id === taskId) : undefined;
  const author = task ? (allUsers.find(u => u.id === task.author_id) ?? user) : user;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
      if (titleRef.current) titleRef.current.value = task?.title ?? '';
      if (descRef.current) descRef.current.value = task?.description ?? '';
      if (doneRef.current) doneRef.current.checked = task?.done ?? false;
      photoRef.current?.set(task?.photo_url ?? null);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const title = titleRef.current?.value.trim() ?? '';
      const description = descRef.current?.value.trim() ?? '';
      const photo = photoRef.current?.value ?? null;
      if (isNew) {
        const partner = allUsers.find(u => u.id !== user.id);
        const saved = await addTask({ title, description, photoUrl: photo, authorId: user.id, date: Format.isoDate(new Date()) });
        if (!saved) return;
        dialogRef.current?.close();
        showToast(`Agregado. Le avisamos a ${partner?.display_name ?? 'tu pareja'}.`);
        onSaved(saved, true);
      } else if (task) {
        const saved = await updateTask(task.id, { title, description, done: doneRef.current?.checked ?? false, photo_url: photo });
        if (!saved) return;
        dialogRef.current?.close();
        showToast('Cambios guardados');
        onSaved(saved, false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="task-modal-title"
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="task-modal-title">{task?.title ?? 'Algo para la casa'}</h2>
        </div>
        <div className="field">
          <label htmlFor="task-title">¿Qué queremos comprar?</label>
          <input ref={titleRef} id="task-title" type="text" maxLength={80} required
            placeholder="Lámpara para el living" />
        </div>
        <div className="field">
          <span className="label">Foto <span className="hint">(opcional)</span></span>
          <PhotoField ref={photoRef} inputId="task-photo-input" />
        </div>
        <div className="field">
          <label htmlFor="task-desc">Descripción</label>
          <textarea ref={descRef} id="task-desc" maxLength={400} required
            placeholder="¿Dónde lo vimos, de qué color, cuánto cuesta?" />
        </div>
        {!isNew && (
          <label className="check-row">
            <input ref={doneRef} id="task-done" type="checkbox" /> Ya lo compramos
          </label>
        )}
        <div className="as-user">
          <svg className="avatar" data-user={author.username} viewBox="0 0 120 120" aria-hidden="true">
            <use href={`#${author.face}`} />
          </svg>
          <span>{task ? `Agregado por ${author.display_name}` : `Se guardará a nombre de ${author.display_name}`}</span>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => dialogRef.current?.close()}>Cancelar</button>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </dialog>
  );
}

/* ---- TaskDetailModal ---- */
function TaskDetailModal({ taskId, tasks, allUsers, onEdit, onDeleted, onClose, showToast }: {
  taskId: number | null;
  tasks: Task[];
  allUsers: User[];
  onEdit: (id: number) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const task = taskId !== null ? tasks.find(t => t.id === taskId) : undefined;
  const author = task ? allUsers.find(u => u.id === task.author_id) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (taskId !== null) {
      setConfirming(false);
      dialog.showModal();
      dialog.scrollTop = 0;
    } else if (dialog.open) {
      dialog.close();
    }
  }, [taskId]);

  async function handleDelete() {
    if (!task) return;
    await deleteTask(task.id);
    dialogRef.current?.close();
    showToast(`${task.title} borrado de la lista`);
    onDeleted(task.id);
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="detail-title"
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
      <div className="detail">
        <div className="detail-head">
          <h2 id="detail-title">{task?.title}</h2>
          <button className="icon-btn" type="button" aria-label="Cerrar"
            onClick={() => dialogRef.current?.close()}>
            <svg className="icon"><use href="#i-close" /></svg>
          </button>
        </div>
        {task && (
          <>
            <div className="detail-media" data-user={!task.photo_url ? author?.username : undefined}>
              {task.photo_url
                ? <img src={task.photo_url} alt={task.title} />
                : <svg aria-hidden="true"><use href="#i-heart" /></svg>}
            </div>
            <p className="detail-desc">{task.description}</p>
            <div className="detail-meta">
              <span className="detail-by">
                {author && (
                  <svg className="avatar" data-user={author.username} viewBox="0 0 120 120" aria-hidden="true">
                    <use href={`#${author.face}`} />
                  </svg>
                )}
                <span>Agregado por <b>{author?.display_name}</b> · {Format.dayMonth(task.date)}</span>
              </span>
              <span className="detail-status" data-done={task.done}>
                <svg className="icon" aria-hidden="true">
                  <use href={task.done ? '#i-check' : '#i-clock'} />
                </svg>
                {task.done ? 'Ya comprado' : 'Por comprar'}
              </span>
            </div>
            {!confirming ? (
              <div className="detail-actions">
                <button className="btn btn-danger" type="button" onClick={() => setConfirming(true)}>Borrar</button>
                <button className="btn" type="button" onClick={() => { dialogRef.current?.close(); onEdit(task.id); }}>Editar</button>
              </div>
            ) : (
              <div className="detail-actions">
                <p className="confirm-text" style={{ flex: '1 1 100%' }}>¿Borrar esto de la lista? No se puede deshacer.</p>
                <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>No, conservar</button>
                <button className="btn" type="button" onClick={handleDelete}>Sí, borrar</button>
              </div>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
