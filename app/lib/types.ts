export interface User {
  id: string;
  username: string;
  display_name: string;
  face: 'face-a' | 'face-b';
}

export interface Account {
  id: number;
  name: string;
  active: boolean;
}

export interface Expense {
  id: number;
  account_id: number;
  amount: number;
  date: string;
  month: string;
  author_id: string;
  photo_url: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  author_id: string;
  done: boolean;
  date: string;
  photo_url: string | null;
}

export interface Notification {
  id: number;
  recipient_id: string;
  task_id: number;
  read: boolean;
  tasks?: { title: string; date: string; author_id: string };
}

export interface ShoppingItem {
  id: number;
  text: string;
  bought_by_id: string | null;
}

export type Route = 'mantenedor' | 'historico' | 'cuentas' | 'nidito' | 'superduper';
export const ROUTES: Route[] = ['mantenedor', 'historico', 'cuentas', 'nidito', 'superduper'];
