import { supabase } from './supabase';
import type { Account, Expense, Notification, ShoppingItem, Task, User } from './types';

// --- Auth ---

export async function signIn(username: string, password: string): Promise<User | null> {
  const email = `${username.toLowerCase().trim()}@fortachones.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return getProfile(data.user.id);
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function restoreSession(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  return getProfile(data.session.user.id);
}

export async function getProfile(userId: string): Promise<User | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}

export async function getAllProfiles(): Promise<User[]> {
  const { data } = await supabase.from('profiles').select('*');
  return data ?? [];
}

// --- Accounts ---

export async function getAccounts(): Promise<Account[]> {
  const { data } = await supabase.from('accounts').select('id, name, active').order('id');
  return data ?? [];
}

export async function addAccount(name: string): Promise<{ account: Account } | { error: string }> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name: name.trim(), active: true })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return { error: `Ya existe una cuenta llamada "${name}".` };
    return { error: 'No se pudo agregar la cuenta. Intenta de nuevo.' };
  }
  return { account: data };
}

export async function updateAccount(id: number, changes: Partial<Account>): Promise<Account | null> {
  const { data, error } = await supabase.from('accounts').update(changes).eq('id', id).select().single();
  if (error) {
    if (error.code === '23505') return null;
  }
  return data ?? null;
}

export async function deleteAccount(id: number) {
  await supabase.from('accounts').delete().eq('id', id);
}

// --- Expenses ---

export async function getExpenses(months?: string[]): Promise<Expense[]> {
  let query = supabase.from('expenses').select('*');
  if (months?.length) query = query.in('month', months);
  const { data } = await query.order('date', { ascending: false });
  return data ?? [];
}

export async function getExpenseAccountIds(): Promise<{ account_id: number }[]> {
  const { data } = await supabase.from('expenses').select('account_id');
  return data ?? [];
}

export async function upsertExpense(params: {
  accountId: number;
  month: string;
  amount: number;
  date: string;
  photoUrl: string | null;
  authorId: string;
  existingId?: number;
}): Promise<Expense | null> {
  const record = {
    account_id: params.accountId,
    month: params.month,
    amount: params.amount,
    date: params.date,
    photo_url: params.photoUrl,
    author_id: params.authorId,
  };
  if (params.existingId) {
    const { data } = await supabase.from('expenses').update(record).eq('id', params.existingId).select().single();
    return data ?? null;
  }
  const { data } = await supabase.from('expenses').insert(record).select().single();
  return data ?? null;
}

export async function deleteExpense(id: number) {
  await supabase.from('expenses').delete().eq('id', id);
}

// --- Tasks ---

export async function getTasks(): Promise<Task[]> {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  return data ?? [];
}

export async function addTask(params: {
  title: string;
  description: string;
  photoUrl: string | null;
  authorId: string;
  date: string;
}): Promise<Task | null> {
  const { data } = await supabase
    .from('tasks')
    .insert({
      title: params.title,
      description: params.description,
      photo_url: params.photoUrl,
      author_id: params.authorId,
      date: params.date,
      done: false,
    })
    .select()
    .single();
  return data ?? null;
}

export async function updateTask(
  id: number,
  changes: { title?: string; description?: string; done?: boolean; photo_url?: string | null }
): Promise<Task | null> {
  const { data } = await supabase.from('tasks').update(changes).eq('id', id).select().single();
  return data ?? null;
}

export async function deleteTask(id: number) {
  await supabase.from('tasks').delete().eq('id', id);
}

// --- Notifications ---

export async function getNotifications(recipientId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*, tasks(title, date, author_id)')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function addNotification(recipientId: string, taskId: number) {
  await supabase.from('notifications').insert({ recipient_id: recipientId, task_id: taskId, read: false });
}

export async function markNotificationRead(id: number) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(recipientId: string) {
  await supabase.from('notifications').update({ read: true }).eq('recipient_id', recipientId).eq('read', false);
}

export async function deleteNotificationsForTask(taskId: number) {
  await supabase.from('notifications').delete().eq('task_id', taskId);
}

// --- Shopping ---

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const { data } = await supabase.from('shopping_items').select('*').order('created_at');
  return data ?? [];
}

export async function addShoppingItem(text: string): Promise<ShoppingItem | null> {
  const { data } = await supabase
    .from('shopping_items')
    .insert({ text, bought_by_id: null })
    .select()
    .single();
  return data ?? null;
}

export async function toggleShoppingItem(id: number, userId: string | null): Promise<ShoppingItem | null> {
  const { data } = await supabase
    .from('shopping_items')
    .update({ bought_by_id: userId })
    .eq('id', id)
    .select()
    .single();
  return data ?? null;
}

export async function updateShoppingItem(id: number, text: string): Promise<ShoppingItem | null> {
  const { data } = await supabase
    .from('shopping_items')
    .update({ text })
    .eq('id', id)
    .select()
    .single();
  return data ?? null;
}

export async function deleteShoppingItem(id: number) {
  await supabase.from('shopping_items').delete().eq('id', id);
}

export async function clearShoppingItems(scope: 'all' | 'bought' | 'pending') {
  if (scope === 'all') {
    await supabase.from('shopping_items').delete().gte('id', 0);
  } else if (scope === 'bought') {
    await supabase.from('shopping_items').delete().not('bought_by_id', 'is', null);
  } else {
    await supabase.from('shopping_items').delete().is('bought_by_id', null);
  }
}
