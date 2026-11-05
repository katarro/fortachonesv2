/* Fortachones – lógica de la aplicación (módulo cliente) */

/* ---------- Configuración ---------- */
const USERS = Object.freeze({
  fortachona: Object.freeze({ id: 'fortachona', name: 'Fortachona', face: 'face-a' }),
  fortachon: Object.freeze({ id: 'fortachon', name: 'Fortachón', face: 'face-b' }),
});
const SHARED_PASSWORD = 'amor123';
const CHART_MONTHS = 6;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/* ---------- Utilidades puras ---------- */
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const avatar = (user) => `<svg class="avatar" data-user="${user.id}" viewBox="0 0 120 120" aria-hidden="true"><use href="#${user.face}"/></svg>`;

const Format = {
  clp: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
  money(value) { return this.clp.format(value); },
  pad(n) { return String(n).padStart(2, '0'); },
  isoDate(date) { return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`; },
  monthKey(date) { return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}`; },
  parseMonth(key) { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1); },
  parseDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); },
  monthLong(key) { return this.parseMonth(key).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(' de ', ' '); },
  monthName(key) { return this.parseMonth(key).toLocaleDateString('es-CL', { month: 'long' }); },
  monthShort(key) { return this.parseMonth(key).toLocaleDateString('es-CL', { month: 'short' }).replace('.', ''); },
  dayMonth(iso) { return this.parseDate(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', ''); },
  capital(text) { return text.charAt(0).toUpperCase() + text.slice(1); },
};

const partnerOf = (user) => Object.values(USERS).find((u) => u.id !== user.id);

const lastMonths = (count, from = new Date()) => Array.from({ length: count }, (_, i) =>
  Format.monthKey(new Date(from.getFullYear(), from.getMonth() - (count - 1 - i), 1)));

/* ---------- Persistencia (en memoria para el MVP) ---------- */
class InMemoryRepository {
  #items; #nextId;
  constructor(seed = []) {
    this.#items = seed.map((item, i) => ({ ...item, id: i + 1 }));
    this.#nextId = seed.length + 1;
  }
  all() { return [...this.#items]; }
  remove(id) { this.#items = this.#items.filter((it) => it.id !== id); }
  add(item) { const saved = { ...item, id: this.#nextId++ }; this.#items.unshift(saved); return saved; }
  update(id, changes) {
    const item = this.#items.find((it) => it.id === id);
    if (item) Object.assign(item, changes);
    return item;
  }
}

/* ---------- Servicios de dominio ---------- */
class SessionStore {
  static #KEY = 'fortachones-sesion';
  load() { try { return localStorage.getItem(SessionStore.#KEY); } catch { return null; } }
  save(userId) { try { localStorage.setItem(SessionStore.#KEY, userId); } catch { /* sin almacenamiento */ } }
  clear() { try { localStorage.removeItem(SessionStore.#KEY); } catch { /* sin almacenamiento */ } }
}

class AuthService {
  #users; #password; #session; #current = null;
  constructor(users, password, session) { this.#users = users; this.#password = password; this.#session = session; }
  get current() { return this.#current; }
  restore() {
    this.#current = this.#users[this.#session.load()] || null;
    return Boolean(this.#current);
  }
  login(username, password, remember = false) {
    const key = username.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const user = this.#users[key];
    if (!user || password !== this.#password) return false;
    this.#current = user;
    if (remember) this.#session.save(user.id); else this.#session.clear();
    return true;
  }
  logout() { this.#current = null; this.#session.clear(); }
}

class AccountService {
  #repo;
  constructor(repo) { this.#repo = repo; }
  all() { return this.#repo.all().sort((a, b) => a.id - b.id); }
  active() { return this.all().filter((a) => a.active); }
  find(id) { return this.all().find((a) => a.id === id); }
  #nameProblem(name, ownId = null) {
    if (!name) return 'Escribe un nombre para la cuenta.';
    const taken = this.all().some((a) => a.id !== ownId && a.name.toLowerCase() === name.toLowerCase());
    return taken ? `Ya existe una cuenta llamada ${name}.` : null;
  }
  add(rawName) {
    const name = rawName.trim();
    const error = this.#nameProblem(name);
    if (error) return { error };
    return { account: this.#repo.add({ name, active: true }) };
  }
  rename(id, rawName) {
    const name = rawName.trim();
    const error = this.#nameProblem(name, id);
    if (error) return { error };
    return { account: this.#repo.update(id, { name }) };
  }
  setActive(id, active) { return this.#repo.update(id, { active }); }
  remove(id) { this.#repo.remove(id); }
}

class ExpenseService {
  #repo;
  constructor(repo) { this.#repo = repo; }
  findFor(accountId, month) {
    return this.#repo.all().find((e) => e.accountId === accountId && e.date.startsWith(month));
  }
  save(accountId, month, data) {
    const existing = this.findFor(accountId, month);
    return existing ? this.#repo.update(existing.id, data) : this.#repo.add({ ...data, accountId });
  }
  countFor(accountId) { return this.#repo.all().filter((e) => e.accountId === accountId).length; }
  availableMonths() {
    return [...new Set(this.#repo.all().map((e) => e.date.slice(0, 7)))].sort().reverse();
  }
  totalFor(month, accountIds) {
    return this.#repo.all()
      .filter((e) => e.date.startsWith(month) && accountIds.includes(e.accountId))
      .reduce((sum, e) => sum + e.amount, 0);
  }
  monthlyTotals(months, accountIds) {
    return months.map((month) => ({ month, total: this.totalFor(month, accountIds) }));
  }
}

class TaskService {
  #repo; #addedListeners = []; #removedListeners = [];
  constructor(repo) { this.#repo = repo; }
  onAdded(listener) { this.#addedListeners.push(listener); }
  onRemoved(listener) { this.#removedListeners.push(listener); }
  add(task) {
    const saved = this.#repo.add(task);
    this.#addedListeners.forEach((listener) => listener(saved));
    return saved;
  }
  update(id, changes) { return this.#repo.update(id, changes); }
  remove(id) {
    this.#repo.remove(id);
    this.#removedListeners.forEach((listener) => listener(id));
  }
  find(id) { return this.#repo.all().find((t) => t.id === id); }
  list() { return this.#repo.all().sort((a, b) => a.done - b.done || b.id - a.id); }
  counts() {
    const all = this.#repo.all();
    const done = all.filter((t) => t.done).length;
    return { pending: all.length - done, done };
  }
}

class NotificationService {
  #repo;
  constructor(repo) { this.#repo = repo; }
  notifyPartner(task) {
    return this.#repo.add({ recipient: partnerOf(USERS[task.author]).id, taskId: task.id, read: false });
  }
  forUser(userId) {
    return this.#repo.all().filter((n) => n.recipient === userId).sort((a, b) => b.id - a.id);
  }
  unreadCount(userId) { return this.forUser(userId).filter((n) => !n.read).length; }
  markRead(id) { return this.#repo.update(id, { read: true }); }
  markAllRead(userId) { this.forUser(userId).forEach((n) => this.markRead(n.id)); }
  removeForTask(taskId) {
    this.#repo.all().filter((n) => n.taskId === taskId).forEach((n) => this.#repo.remove(n.id));
  }
}

class ShoppingService {
  #repo;
  constructor(repo) { this.#repo = repo; }
  add(text) { return this.#repo.add({ text, boughtBy: null }); }
  toggle(id, userId) {
    const item = this.#repo.all().find((i) => i.id === id);
    return this.#repo.update(id, { boughtBy: item.boughtBy ? null : userId });
  }
  find(id) { return this.#repo.all().find((i) => i.id === id); }
  rename(id, text) { return this.#repo.update(id, { text }); }
  remove(id) { this.#repo.remove(id); }
  clear(scope) {
    const items = this.list(scope);
    items.forEach((i) => this.#repo.remove(i.id));
    return items.length;
  }
  list(filter = 'all') {
    return this.#repo.all().filter((i) => filter === 'all' || (filter === 'bought') === Boolean(i.boughtBy));
  }
  counts() {
    const all = this.#repo.all();
    const bought = all.filter((i) => i.boughtBy).length;
    return { pending: all.length - bought, bought };
  }
}

class PhotoReader {
  static read(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('Ese archivo no es una imagen. Elige un JPG, PNG o similar.'));
      if (file.size > MAX_PHOTO_BYTES) return reject(new Error('La foto pesa más de 8 MB. Elige una más liviana.'));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer la foto. Intenta con otra.'));
      reader.readAsDataURL(file);
    });
  }
}

/* ---------- Datos de ejemplo ---------- */
class SampleData {
  static #SEASON = {
    Luz: [34, 32, 31, 33, 37, 43, 47, 45, 41, 37, 35, 34],
    Gas: [12, 11, 14, 20, 30, 38, 42, 40, 31, 22, 16, 13],
    Agua: [24, 25, 21, 18, 15, 14, 14, 14, 15, 17, 20, 23],
  };

  static #receipt(title, amount) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#d9c7d8"/><g transform="rotate(-4 200 150)"><rect x="115" y="22" width="170" height="256" fill="#fffdf8"/><text x="200" y="62" font-family="sans-serif" font-size="17" font-weight="700" text-anchor="middle" fill="#2c1226">BOLETA ${title.toUpperCase()}</text><rect x="135" y="82" width="130" height="5" fill="#d6c8d2"/><rect x="135" y="98" width="100" height="5" fill="#d6c8d2"/><rect x="135" y="114" width="118" height="5" fill="#d6c8d2"/><text x="200" y="172" font-family="sans-serif" font-size="25" font-weight="700" text-anchor="middle" fill="#bd1e43">${amount}</text><text x="200" y="238" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#6e5068">Imagen de ejemplo</text></g></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  static #scene(color, shape) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${color}"/>${shape}<text x="200" y="284" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#ffffff" opacity=".85">Imagen de ejemplo</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  static accounts() {
    return [
      { name: 'Luz', active: true }, { name: 'Agua', active: true }, { name: 'Gas', active: true },
      { name: 'Internet', active: true }, { name: 'Telefonía', active: true }, { name: 'Gastos comunes', active: true },
      { name: 'Arriendo', active: false }, { name: 'Estacionamiento', active: false },
    ];
  }

  static expenses(accounts, today = new Date()) {
    const result = [];
    const months = lastMonths(CHART_MONTHS, today);
    const idOf = (name) => accounts.find((a) => a.name === name).id;
    months.forEach((key, index) => {
      const month = Format.parseMonth(key).getMonth();
      const isCurrent = index === months.length - 1;
      const day = (d) => `${key}-${Format.pad(isCurrent ? Math.min(d, today.getDate()) : d)}`;
      const cents = (month * 137) % 900;
      const rounded = (base) => Math.round((base * 1000 + cents) / 10) * 10;
      const rows = [
        { name: 'Gastos comunes', amount: 68000 + index * 1500, date: day(3), author: 'fortachon' },
        { name: 'Internet', amount: 24990, date: day(5), author: 'fortachona' },
        { name: 'Telefonía', amount: 18990, date: day(8), author: 'fortachona' },
        { name: 'Luz', amount: rounded(this.#SEASON.Luz[month]), date: day(12), author: 'fortachona' },
        { name: 'Agua', amount: rounded(this.#SEASON.Agua[month]), date: day(15), author: 'fortachon' },
        { name: 'Gas', amount: rounded(this.#SEASON.Gas[month]), date: day(20), author: 'fortachon' },
      ];
      const uploaded = isCurrent ? rows.filter((r) => ['Gastos comunes', 'Internet'].includes(r.name)) : rows;
      uploaded.forEach(({ name, ...row }) => {
        const hasPhoto = (name === 'Internet' && isCurrent) || (['Luz', 'Agua', 'Gas'].includes(name) && index === months.length - 2);
        result.push({ ...row, accountId: idOf(name), photo: hasPhoto ? this.#receipt(name, Format.money(row.amount)) : null });
      });
    });
    return result;
  }

  static notifications(tasks) {
    const unread = ['Cojines para el sillón', 'Hervidor eléctrico'];
    return [...tasks].sort((a, b) => a.id - b.id).map((task) => ({
      recipient: partnerOf(USERS[task.author]).id,
      taskId: task.id,
      read: !unread.includes(task.title),
    }));
  }

  static shopping() {
    return [
      { text: 'Leche descremada', boughtBy: null },
      { text: 'Pan de molde', boughtBy: null },
      { text: 'Huevos', boughtBy: 'fortachona' },
      { text: 'Tomates y paltas', boughtBy: null },
      { text: 'Café', boughtBy: 'fortachon' },
      { text: 'Detergente', boughtBy: null },
    ];
  }

  static tasks(today = new Date()) {
    const daysAgo = (n) => Format.isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
    return [
      { title: 'Plantas para el balcón', description: 'Una albahaca y un helecho, con maceteros grandes.', author: 'fortachona', done: true, date: daysAgo(7),
        photo: this.#scene('#125f4e', '<path d="M200 248V130M200 170c-50 0-74-28-78-74 48 0 76 26 78 74zM200 150c6-44 32-68 80-70-2 46-30 70-80 70z" fill="#ffffff" stroke="#ffffff" stroke-width="7" stroke-linejoin="round" opacity=".88"/>') },
      { title: 'Repisa para el living', description: 'La que vimos de madera clara, para poner al lado de la ventana.', author: 'fortachon', done: true, date: daysAgo(5),
        photo: this.#scene('#7a1c6d', '<g fill="#ffffff" opacity=".88"><rect x="92" y="108" width="216" height="12" rx="2"/><rect x="92" y="196" width="216" height="12" rx="2"/><rect x="124" y="62" width="20" height="46"/><rect x="150" y="72" width="24" height="36"/><rect x="246" y="150" width="22" height="46"/></g>') },
      { title: 'Cortinas para el dormitorio', description: 'Que oscurezcan bien. Hay que medir la ventana antes de ir a la tienda.', author: 'fortachon', done: false, date: daysAgo(2), photo: null },
      { title: 'Cojines para el sillón', description: 'Dos rojos y uno morado, de tela suave. Los vimos en oferta hasta fin de mes.', author: 'fortachona', done: false, date: daysAgo(1),
        photo: this.#scene('#b01a42', '<path d="M200 232c-64-50-92-82-92-118a50 50 0 0 1 92-29 50 50 0 0 1 92 29c0 36-28 68-92 118z" fill="#ffffff" opacity=".88"/>') },
      { title: 'Hervidor eléctrico', description: 'El nuestro ya gotea por abajo. Ojalá de acero y de 1,7 litros.', author: 'fortachon', done: false, date: daysAgo(0),
        photo: this.#scene('#5a2796', '<path d="M200 70c34 50 56 80 56 112a56 56 0 0 1-112 0c0-32 22-62 56-112z" fill="#ffffff" opacity=".88"/>') },
    ];
  }
}

/* ---------- Componentes reutilizables ---------- */
class ThemeController {
  static #KEY = 'fortachones-tema';
  constructor(root = document.documentElement) {
    this.root = root;
    try { const saved = localStorage.getItem(ThemeController.#KEY); if (saved) root.dataset.theme = saved; } catch { /* sin almacenamiento */ }
    document.addEventListener('click', (e) => { if (e.target.closest('[data-theme-toggle]')) this.toggle(); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.paint());
    this.paint();
  }
  get isDark() {
    return this.root.dataset.theme ? this.root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  toggle() {
    this.root.dataset.theme = this.isDark ? 'light' : 'dark';
    try { localStorage.setItem(ThemeController.#KEY, this.root.dataset.theme); } catch { /* sin almacenamiento */ }
    this.paint();
  }
  paint() {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const label = button.dataset.label ? (this.isDark ? 'Modo claro' : 'Modo oscuro') : '';
      button.innerHTML = icon(this.isDark ? 'sun' : 'moon') + label;
    });
  }
}

class HeartRain {
  static #COLORS = ['var(--red)', 'var(--purple)', 'var(--red)', 'var(--green)', 'var(--lip)'];
  constructor(container, count = 36) {
    const random = (min, max) => min + Math.random() * (max - min);
    container.innerHTML = Array.from({ length: count }, (_, i) => {
      const duration = random(7, 16);
      const style = [
        `--x:${random(0, 98).toFixed(1)}%`, `--y:${random(0, 95).toFixed(1)}%`, `--s:${random(13, 36).toFixed(0)}px`,
        `--o:${random(.45, .9).toFixed(2)}`, `--d:${duration.toFixed(1)}s`, `--delay:${(-random(0, duration)).toFixed(1)}s`,
        `--sway:${random(-40, 40).toFixed(0)}px`, `--c:${HeartRain.#COLORS[i % HeartRain.#COLORS.length]}`,
      ].join(';');
      return `<svg style="${style}"><use href="#i-heart"/></svg>`;
    }).join('');
  }
}

class Toast {
  #el; #timer;
  constructor(el) { this.#el = el; }
  show(message) {
    this.#el.textContent = message;
    this.#el.hidden = false;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.#el.hidden = true; }, 3200);
  }
}

class PhotoField {
  #root; #value = null;
  constructor(root, id) {
    this.#root = root;
    root.classList.add('photo-field');
    root.innerHTML = `
      <label class="photo-drop" for="${id}">${icon('camera')}<span>Subir o tomar una foto</span>
        <input class="photo-input" id="${id}" type="file" accept="image/*">
      </label>
      <div class="photo-preview" hidden><img alt="Vista previa de la foto"><button class="photo-remove" type="button">Quitar</button></div>
      <p class="photo-error" role="alert" hidden></p>`;
    $('.photo-input', root).addEventListener('change', (e) => this.#select(e.target.files[0]));
    $('.photo-remove', root).addEventListener('click', () => this.reset());
  }
  get value() { return this.#value; }
  set(value) {
    this.reset();
    if (!value) return;
    this.#value = value;
    $('img', this.#root).src = value;
    $('.photo-preview', this.#root).hidden = false;
    $('.photo-drop', this.#root).hidden = true;
  }
  async #select(file) {
    if (!file) return;
    const error = $('.photo-error', this.#root);
    error.hidden = true;
    try {
      this.#value = await PhotoReader.read(file);
      $('img', this.#root).src = this.#value;
      $('.photo-preview', this.#root).hidden = false;
      $('.photo-drop', this.#root).hidden = true;
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      $('.photo-input', this.#root).value = '';
    }
  }
  reset() {
    this.#value = null;
    $('.photo-input', this.#root).value = '';
    $('.photo-preview', this.#root).hidden = true;
    $('.photo-drop', this.#root).hidden = false;
    $('.photo-error', this.#root).hidden = true;
  }
}

class ChipGroup {
  #root; #onChange; #options; #value;
  constructor(root, options, initial, onChange) {
    this.#root = root; this.#options = options; this.#value = initial; this.#onChange = onChange;
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-value]');
      if (chip) { this.value = chip.dataset.value; this.#onChange(this.#value); }
    });
    this.#paint();
  }
  get value() { return this.#value; }
  set value(next) { this.#value = next; this.#paint(); }
  set options(next) { this.#options = next; this.#paint(); }
  #paint() {
    this.#root.innerHTML = this.#options.map(({ value, label }) =>
      `<button class="chip" type="button" data-value="${escapeHtml(value)}" aria-pressed="${value === this.#value}">${escapeHtml(label)}</button>`).join('');
  }
}

/* ---------- Vistas ---------- */
class LoginView {
  constructor({ auth, onSuccess }) {
    const form = $('#login-form');
    const error = $('#login-error');
    const pass = $('#login-pass');
    const toggle = $('#login-pass-toggle');
    toggle.addEventListener('click', () => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Ocultar' : 'Mostrar';
      toggle.setAttribute('aria-pressed', String(show));
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (auth.login($('#login-user').value, pass.value, $('#login-remember').checked)) {
        error.hidden = true;
        form.reset();
        onSuccess();
      } else {
        error.textContent = 'Usuario o contraseña incorrectos. Revisa ambos e intenta de nuevo.';
        error.hidden = false;
        pass.select();
      }
    });
  }
}

const billMedia = (photo, author) => {
  if (photo) return `<span class="bill-media"><img src="${escapeHtml(photo)}" alt=""></span>`;
  return `<span class="bill-media" data-user="${author}"><svg class="fill" aria-hidden="true"><use href="#i-heart"/></svg></span>`;
};
const billEmptyMedia = (name) => `<span class="bill-media">${icon(name)}</span>`;

class BillCard {
  static compact(value) {
    return value >= 1000 ? `$${Math.round(value / 1000)} mil` : Format.money(value);
  }
  static render(account, month, expense) {
    const name = escapeHtml(account.name);
    const attrs = `class="bill" type="button" data-account="${account.id}" data-month="${month}"`;
    if (!expense) {
      return `<button ${attrs} data-state="missing" aria-label="Subir la cuenta de ${name}">
        ${billEmptyMedia('camera')}
        <span class="bill-body">
          <span class="bill-name">${name}</span>
          <span class="bill-amount">Por subir</span>
          <span class="bill-by">Toca para subirla</span>
        </span>
      </button>`;
    }
    const user = USERS[expense.author];
    return `<button ${attrs} data-state="done" aria-label="Actualizar la cuenta de ${name}: ${Format.money(expense.amount)}">
      ${billMedia(expense.photo, expense.author)}
      <span class="bill-body">
        <span class="bill-name">${icon('check')}${name}</span>
        <span class="bill-amount">${Format.money(expense.amount)}</span>
        <span class="bill-by">${avatar(user)}<span>Subida por <b>${user.name}</b> · ${Format.dayMonth(expense.date)}</span></span>
      </span>
    </button>`;
  }
}

class MonthlyBarChart {
  #root;
  static #SCALE = 84;
  constructor(root, onPick) {
    this.#root = root;
    root.addEventListener('click', (e) => {
      const col = e.target.closest('[data-month]');
      if (col) onPick(col.dataset.month);
    });
  }
  render({ totals, selected, currentKey }) {
    const max = Math.max(...totals.map((t) => t.total));
    const peak = totals.find((t) => t.total === max);
    this.#root.innerHTML = totals.map(({ month, total }) => {
      const height = max ? (total / max) * MonthlyBarChart.#SCALE : 0;
      const showLabel = total > 0 && (month === currentKey || month === peak.month);
      return `<button class="bar-col" type="button" data-month="${month}" data-current="${month === currentKey}" aria-pressed="${selected.has(month)}" aria-label="${Format.monthLong(month)}: ${Format.money(total)}" title="${Format.money(total)}">
        <span class="bar-track">
          <span class="bar" style="height:${height.toFixed(1)}%"></span>
          <span class="bar-value" data-label="${showLabel}" style="bottom:calc(${height.toFixed(1)}% + 5px)">${BillCard.compact(total)}</span>
        </span>
        <span class="bar-month">${Format.monthShort(month)}</span>
      </button>`;
    }).join('');
    return peak;
  }
}

class ExpenseModal {
  #dialog; #accounts; #expenses; #auth; #toast; #onSaved; #photo;
  #accountId = null; #month = null;

  constructor({ dialog, accounts, expenses, auth, toast, onSaved }) {
    this.#dialog = dialog; this.#accounts = accounts; this.#expenses = expenses;
    this.#auth = auth; this.#toast = toast; this.#onSaved = onSaved;
    this.#photo = new PhotoField($('#exp-photo'), 'exp-photo-input');
    $('#expense-form').addEventListener('submit', (e) => this.#submit(e));
    $('#modal-cancel').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  open(accountId, month) {
    this.#accountId = accountId; this.#month = month;
    const account = this.#accounts.find(accountId);
    const existing = this.#expenses.findFor(accountId, month);
    const { min, max } = ExpenseModal.#dateRange(month);
    $('#modal-title').textContent = `${existing ? 'Actualizar' : 'Subir'} ${account.name}`;
    $('#modal-month').textContent = Format.capital(Format.monthLong(month));
    $('#exp-amount').value = existing ? existing.amount : '';
    const date = $('#exp-date');
    date.min = min; date.max = max; date.value = existing ? existing.date : max;
    this.#photo.set(existing ? existing.photo : null);
    this.#dialog.showModal();
  }

  static #dateRange(month) {
    const first = Format.parseMonth(month);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const today = new Date();
    return { min: Format.isoDate(first), max: Format.isoDate(last < today ? last : today) };
  }

  #submit(event) {
    event.preventDefault();
    const amount = Number($('#exp-amount').value);
    this.#expenses.save(this.#accountId, this.#month, {
      amount,
      date: $('#exp-date').value,
      photo: this.#photo.value,
      author: this.#auth.current.id,
    });
    this.#dialog.close();
    this.#toast.show(`${this.#accounts.find(this.#accountId).name}: ${Format.money(amount)} guardados`);
    this.#onSaved();
  }
}

const bindBillCards = (root, modal) => {
  root.addEventListener('click', (e) => {
    const bill = e.target.closest('[data-account]');
    if (bill) modal.open(Number(bill.dataset.account), bill.dataset.month);
  });
};

const noActiveAccounts = '<p class="empty" style="grid-column:1/-1">No hay cuentas activas. Actívalas o agrégalas en <a href="#mantenedor">Mantenedor</a>.</p>';

class CurrentExpensesView {
  #accounts; #expenses;
  #month = Format.monthKey(new Date());

  constructor({ accounts, expenses, modal }) {
    this.#accounts = accounts; this.#expenses = expenses;
    bindBillCards($('#current-cards'), modal);
  }

  render() {
    const active = this.#accounts.active();
    const uploaded = active.filter((a) => this.#expenses.findFor(a.id, this.#month)).length;
    const total = this.#expenses.totalFor(this.#month, active.map((a) => a.id));
    $('#current-title').textContent = `Cuentas de ${Format.monthName(this.#month)}`;
    $('#current-note').textContent = `${uploaded} de ${active.length} subidas · Total ${Format.money(total)}`;
    $('#current-cards').innerHTML = active.length
      ? active.map((a) => BillCard.render(a, this.#month, this.#expenses.findFor(a.id, this.#month))).join('')
      : noActiveAccounts;
  }
}

class HistoryView {
  #accounts; #expenses; #chart; #filter;
  #months = lastMonths(CHART_MONTHS);
  #category = 'all';
  #month = this.#months[this.#months.length - 2];
  #showAll = false;

  constructor({ accounts, expenses, modal }) {
    this.#accounts = accounts; this.#expenses = expenses;
    this.#chart = new MonthlyBarChart($('#chart'), (month) => this.#goTo(month));
    this.#filter = new ChipGroup($('#category-filter'), [], 'all', (value) => { this.#category = value; this.render(); });
    $('#month-picker').addEventListener('click', (e) => {
      const control = e.target.closest('[data-pick]');
      if (!control || control.disabled) return;
      if (control.dataset.pick === 'all') { this.#showAll = !this.#showAll; this.render(); }
      else this.#step(Number(control.dataset.pick));
    });
    bindBillCards($('#history'), modal);
  }

  get #pickableMonths() {
    return [...new Set([Format.monthKey(new Date()), ...this.#expenses.availableMonths()])].sort().reverse();
  }

  #goTo(month) {
    this.#month = month;
    this.#showAll = false;
    this.render();
  }

  #step(offset) {
    const months = this.#pickableMonths;
    this.#goTo(months[months.indexOf(this.#month) + offset]);
  }

  #renderMonthPicker(months) {
    const index = months.indexOf(this.#month);
    $('#month-picker').innerHTML = `
      <button class="chip" type="button" data-pick="all" aria-pressed="${this.#showAll}">Todos</button>
      <div class="month-step">
        <button class="icon-btn" type="button" data-pick="1" aria-label="Mes anterior" ${index >= months.length - 1 ? 'disabled' : ''}>${icon('left')}</button>
        <span class="month-now" aria-live="polite">${this.#showAll ? 'Todos los meses' : Format.capital(Format.monthLong(this.#month))}</span>
        <button class="icon-btn" type="button" data-pick="-1" aria-label="Mes siguiente" ${index <= 0 ? 'disabled' : ''}>${icon('right')}</button>
      </div>`;
  }

  #syncFilter(active) {
    if (this.#category !== 'all' && !active.some((a) => String(a.id) === this.#category)) this.#category = 'all';
    this.#filter.options = [{ value: 'all', label: 'Todas' }, ...active.map((a) => ({ value: String(a.id), label: a.name }))];
    this.#filter.value = this.#category;
  }

  render() {
    const active = this.#accounts.active();
    this.#syncFilter(active);
    const shown = this.#category === 'all' ? active : active.filter((a) => String(a.id) === this.#category);
    const ids = shown.map((a) => a.id);
    const pickable = this.#pickableMonths;
    const chosen = this.#showAll ? pickable : [this.#month];
    const count = chosen.reduce((n, month) => n + shown.filter((a) => this.#expenses.findFor(a.id, month)).length, 0);

    $('#history-note').textContent = `${count} de ${shown.length * chosen.length} cuentas subidas`;

    this.#renderChart(ids, new Set(chosen));
    this.#renderMonthPicker(pickable);

    if (!active.length) { $('#history').innerHTML = noActiveAccounts; return; }
    $('#history').innerHTML = chosen.map((month) => `
      <section class="month-section">
        <div class="month-head"><span>${Format.monthLong(month)}</span><span>${Format.money(this.#expenses.totalFor(month, ids))}</span></div>
        <div class="bill-grid">${shown.map((a) => BillCard.render(a, month, this.#expenses.findFor(a.id, month))).join('')}</div>
      </section>`).join('');
  }

  #renderChart(ids, selected) {
    const totals = this.#expenses.monthlyTotals(this.#months, ids);
    const peak = this.#chart.render({ totals, selected, currentKey: this.#months[this.#months.length - 1] });
    const withData = totals.filter((t) => t.total > 0);
    const average = withData.length ? withData.reduce((s, t) => s + t.total, 0) / withData.length : 0;
    $('#chart-note').textContent = withData.length
      ? `Mes más alto: ${Format.monthName(peak.month)}, ${Format.money(peak.total)}. Promedio: ${Format.money(Math.round(average))}. El mes actual va en rojo.`
      : 'Todavía no hay cuentas subidas en los últimos 6 meses.';
  }
}

class AccountsView {
  #accounts; #expenses; #toast;

  constructor({ accounts, expenses, toast }) {
    this.#accounts = accounts; this.#expenses = expenses; this.#toast = toast;
    $('#account-form').addEventListener('submit', (e) => this.#submit(e));
    const list = $('#account-list');
    list.addEventListener('change', (e) => this.#onChange(e));
    list.addEventListener('click', (e) => this.#onClick(e));
  }

  #submit(event) {
    event.preventDefault();
    const { account, error } = this.#accounts.add($('#account-name').value);
    const box = $('#account-error');
    box.hidden = !error;
    box.textContent = error || '';
    if (error) return;
    event.target.reset();
    this.#toast.show(`${account.name} agregada a las cuentas`);
    this.render();
  }

  #onChange(event) {
    const row = event.target.closest('[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (event.target.type === 'checkbox') {
      const account = this.#accounts.setActive(id, event.target.checked);
      this.#toast.show(`${account.name} ${account.active ? 'activada' : 'desactivada'}`);
    } else {
      const { account, error } = this.#accounts.rename(id, event.target.value);
      this.#toast.show(error || `Nombre cambiado a ${account.name}`);
    }
    this.render();
  }

  #onClick(event) {
    const button = event.target.closest('[data-delete]');
    if (!button) return;
    const id = Number(button.dataset.delete);
    const { name } = this.#accounts.find(id);
    this.#accounts.remove(id);
    this.#toast.show(`${name} eliminada`);
    this.render();
  }

  render() {
    const all = this.#accounts.all();
    const activeCount = all.filter((a) => a.active).length;
    $('#accounts-note').textContent = `${activeCount} de ${all.length} activas`;
    $('#account-list').innerHTML = all.map((a) => {
      const count = this.#expenses.countFor(a.id);
      const name = escapeHtml(a.name);
      const usage = count === 1 ? '1 registro' : `${count} registros`;
      return `<div class="account-row" data-id="${a.id}">
        <label class="switch"><input type="checkbox" id="acct-on-${a.id}" ${a.active ? 'checked' : ''} aria-label="Activar ${name}"><span></span></label>
        <input type="text" id="acct-name-${a.id}" value="${name}" maxlength="40" aria-label="Nombre de la cuenta ${name}">
        <div class="account-meta"><span>${usage}</span>${count ? '' : `<button class="account-delete" type="button" data-delete="${a.id}">Eliminar</button>`}</div>
      </div>`;
    }).join('');
  }
}

class TaskCard {
  static add() {
    return `<button class="bill" type="button" data-task="new" data-state="missing" aria-label="Agregar algo para comprar">
      ${billEmptyMedia('plus')}
      <span class="bill-body">
        <span class="bill-amount">Algo nuevo</span>
        <span class="bill-by">Toca para agregarlo</span>
      </span>
    </button>`;
  }
  static render(t) {
    const user = USERS[t.author];
    const title = escapeHtml(t.title);
    return `<button class="bill" type="button" data-task="${t.id}" data-state="${t.done ? 'finished' : 'open'}" aria-label="Abrir ${title}${t.done ? ', ya comprado' : ''}">
      ${billMedia(t.photo, t.author)}
      <span class="bill-body">
        <span class="bill-name">${t.done ? icon('check') : ''}<span>${title}</span></span>
        <span class="bill-desc">${escapeHtml(t.description)}</span>
        <span class="bill-by">${avatar(user)}<span>Agregado por <b>${user.name}</b> · ${Format.dayMonth(t.date)}</span></span>
      </span>
    </button>`;
  }
}

class TaskModal {
  #dialog; #tasks; #auth; #toast; #onSaved; #photo; #taskId = null;

  constructor({ dialog, tasks, auth, toast, onSaved }) {
    this.#dialog = dialog; this.#tasks = tasks; this.#auth = auth; this.#toast = toast; this.#onSaved = onSaved;
    this.#photo = new PhotoField($('#task-photo'), 'task-photo-input');
    $('#task-form').addEventListener('submit', (e) => this.#submit(e));
    $('#task-cancel').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  open(taskId = null) {
    this.#taskId = taskId;
    const task = taskId ? this.#tasks.find(taskId) : null;
    const user = task ? USERS[task.author] : this.#auth.current;
    $('#task-modal-title').textContent = task ? task.title : 'Algo para la casa';
    $('#task-title').value = task ? task.title : '';
    $('#task-desc').value = task ? task.description : '';
    $('#task-done').checked = task ? task.done : false;
    $('#task-done-row').hidden = !task;
    $('#task-modal-by').innerHTML = `${avatar(user)}<span>${task ? `Agregado por ${user.name}` : `Se guardará a nombre de ${user.name}`}</span>`;
    this.#photo.set(task ? task.photo : null);
    this.#dialog.showModal();
  }

  #submit(event) {
    event.preventDefault();
    const data = {
      title: $('#task-title').value.trim(),
      description: $('#task-desc').value.trim(),
      photo: this.#photo.value,
    };
    if (this.#taskId) {
      this.#tasks.update(this.#taskId, { ...data, done: $('#task-done').checked });
      this.#toast.show('Cambios guardados');
    } else {
      this.#tasks.add({ ...data, author: this.#auth.current.id, done: false, date: Format.isoDate(new Date()) });
      this.#toast.show(`Agregado. Le avisamos a ${partnerOf(this.#auth.current).name}.`);
    }
    this.#dialog.close();
    this.#onSaved();
  }
}

class TaskDetailModal {
  #dialog; #tasks; #toast; #onEdit; #onDeleted; #taskId = null;

  constructor({ dialog, tasks, toast, onEdit, onDeleted }) {
    this.#dialog = dialog; this.#tasks = tasks; this.#toast = toast; this.#onEdit = onEdit; this.#onDeleted = onDeleted;
    $('#detail-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    $('#detail-edit').addEventListener('click', () => { dialog.close(); this.#onEdit(this.#taskId); });
    $('#detail-delete').addEventListener('click', () => this.#askConfirmation(true));
    $('#detail-keep').addEventListener('click', () => this.#askConfirmation(false));
    $('#detail-confirm-delete').addEventListener('click', () => this.#delete());
  }

  open(taskId) {
    this.#taskId = taskId;
    const task = this.#tasks.find(taskId);
    const user = USERS[task.author];
    $('#detail-title').textContent = task.title;
    $('#detail-desc').textContent = task.description;
    const media = $('#detail-media');
    media.dataset.user = task.photo ? '' : task.author;
    media.innerHTML = task.photo
      ? `<img src="${escapeHtml(task.photo)}" alt="${escapeHtml(task.title)}">`
      : '<svg aria-hidden="true"><use href="#i-heart"/></svg>';
    $('#detail-meta').innerHTML = `
      <span class="detail-by">${avatar(user)}<span>Agregado por <b>${user.name}</b> · ${Format.dayMonth(task.date)}</span></span>
      <span class="detail-status" data-done="${task.done}">${icon(task.done ? 'check' : 'clock')}${task.done ? 'Ya comprado' : 'Por comprar'}</span>`;
    this.#askConfirmation(false);
    this.#dialog.showModal();
    this.#dialog.scrollTop = 0;
  }

  #askConfirmation(asking) {
    $('#detail-actions').hidden = asking;
    $('#detail-confirm').hidden = !asking;
  }

  #delete() {
    const { title } = this.#tasks.find(this.#taskId);
    this.#tasks.remove(this.#taskId);
    this.#dialog.close();
    this.#toast.show(`${title} borrado de la lista`);
    this.#onDeleted();
  }
}

class TasksView {
  #tasks;
  constructor({ tasks, modal, detail }) {
    this.#tasks = tasks;
    $('#task-grid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-task]');
      if (!card) return;
      if (card.dataset.task === 'new') modal.open();
      else detail.open(Number(card.dataset.task));
    });
  }
  render() {
    const { pending, done } = this.#tasks.counts();
    $('#task-note').textContent = `${pending} por comprar · ${done} ${done === 1 ? 'comprado' : 'comprados'}`;
    $('#task-grid').innerHTML = TaskCard.add() + this.#tasks.list().map(TaskCard.render).join('');
  }
}

class TapDetector {
  #delay; #onSingle; #onDouble; #pending = null; #timer = null;
  constructor({ delay = 260, onSingle, onDouble }) {
    this.#delay = delay; this.#onSingle = onSingle; this.#onDouble = onDouble;
  }
  tap(key) {
    clearTimeout(this.#timer);
    if (this.#pending === key) {
      this.#pending = null;
      this.#onDouble(key);
      return;
    }
    if (this.#pending !== null) this.#onSingle(this.#pending);
    this.#pending = key;
    this.#timer = setTimeout(() => {
      this.#pending = null;
      this.#onSingle(key);
    }, this.#delay);
  }
}

class ShoppingEditModal {
  #dialog; #shopping; #toast; #onChanged; #id = null;

  constructor({ dialog, shopping, toast, onChanged }) {
    this.#dialog = dialog; this.#shopping = shopping; this.#toast = toast; this.#onChanged = onChanged;
    $('#shop-edit-form').addEventListener('submit', (e) => this.#save(e));
    $('#shop-edit-cancel').addEventListener('click', () => dialog.close());
    $('#shop-edit-delete').addEventListener('click', () => this.#confirming(true));
    $('#shop-delete-keep').addEventListener('click', () => this.#confirming(false));
    $('#shop-delete-yes').addEventListener('click', () => this.#delete());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  open(id) {
    this.#id = id;
    $('#shop-edit-text').value = this.#shopping.find(id).text;
    this.#confirming(false);
    this.#dialog.showModal();
  }

  #confirming(asking) {
    $('#shop-edit-actions').hidden = asking;
    $('#shop-delete-confirm').hidden = !asking;
  }

  #save(event) {
    event.preventDefault();
    const input = $('#shop-edit-text');
    const text = input.value.trim();
    if (!text) { input.value = ''; input.reportValidity(); return; }
    this.#shopping.rename(this.#id, text);
    this.#dialog.close();
    this.#toast.show('Compra actualizada');
    this.#onChanged();
  }

  #delete() {
    const { text } = this.#shopping.find(this.#id);
    this.#shopping.remove(this.#id);
    this.#dialog.close();
    this.#toast.show(`${text} eliminado`);
    this.#onChanged();
  }
}

class ShoppingClearModal {
  static #SCOPES = [
    { value: 'bought', label: 'Comprados', question: (n) => `lo comprado (${n})` },
    { value: 'pending', label: 'Pendientes', question: (n) => `lo pendiente (${n})` },
    { value: 'all', label: 'Todos', question: (n) => `todos los registros (${n})` },
  ];
  #dialog; #shopping; #toast; #onChanged; #scope = null;

  constructor({ dialog, shopping, toast, onChanged }) {
    this.#dialog = dialog; this.#shopping = shopping; this.#toast = toast; this.#onChanged = onChanged;
    $('#clear-form').addEventListener('submit', (e) => { e.preventDefault(); this.#askConfirmation(); });
    $('#clear-cancel').addEventListener('click', () => dialog.close());
    $('#clear-back').addEventListener('click', () => this.#showStep(false));
    $('#clear-yes').addEventListener('click', () => this.#clear());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  #count(scope) { return this.#shopping.list(scope).length; }

  open() {
    const scopes = ShoppingClearModal.#SCOPES;
    const first = scopes.find((o) => this.#count(o.value) > 0).value;
    const legend = $('#clear-choices legend').outerHTML;
    $('#clear-choices').innerHTML = legend + scopes.map((o) => {
      const n = this.#count(o.value);
      return `<label class="choice"><input type="radio" name="clear-scope" id="clear-${o.value}" value="${o.value}" ${o.value === first ? 'checked' : ''} ${n ? '' : 'disabled'}><span>${o.label}</span><span>${n}</span></label>`;
    }).join('');
    this.#showStep(false);
    this.#dialog.showModal();
  }

  #showStep(confirming) {
    $('#clear-step-choose').hidden = confirming;
    $('#clear-step-confirm').hidden = !confirming;
  }

  #askConfirmation() {
    this.#scope = $('input[name="clear-scope"]:checked').value;
    const option = ShoppingClearModal.#SCOPES.find((o) => o.value === this.#scope);
    $('#clear-message').textContent = `¿Seguro que quieres limpiar ${option.question(this.#count(this.#scope))}? No se puede deshacer.`;
    this.#showStep(true);
  }

  #clear() {
    const removed = this.#shopping.clear(this.#scope);
    this.#dialog.close();
    this.#toast.show(removed === 1 ? 'Se limpió 1 registro' : `Se limpiaron ${removed} registros`);
    this.#onChanged();
  }
}

class ShoppingView {
  static #EMPTY = {
    all: 'La lista está vacía. Escribe arriba la primera compra.',
    pending: 'No queda nada por comprar.',
    bought: 'Todavía no han comprado nada.',
  };
  #shopping; #auth; #tap; #filter = 'all';

  constructor({ shopping, auth, editModal, clearModal }) {
    this.#shopping = shopping; this.#auth = auth;
    this.#tap = new TapDetector({
      onSingle: (id) => this.#toggle(id),
      onDouble: (id) => editModal.open(id),
    });
    new ChipGroup($('#shop-filter'),
      [{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'bought', label: 'Comprados' }],
      'all', (value) => { this.#filter = value; this.render(); });
    $('#shop-form').addEventListener('submit', (e) => this.#submit(e));
    $('#shop-clear').addEventListener('click', () => clearModal.open());
    $('#shop-list').addEventListener('click', (e) => {
      const row = e.target.closest('[data-item]');
      if (row) this.#tap.tap(Number(row.dataset.item));
    });
  }

  #submit(event) {
    event.preventDefault();
    const input = $('#shop-input');
    const text = input.value.trim();
    input.value = '';
    input.focus();
    if (!text) return;
    this.#shopping.add(text);
    this.render();
  }

  #toggle(id) {
    if (!this.#shopping.find(id)) return;
    this.#shopping.toggle(id, this.#auth.current.id);
    this.render();
    document.querySelector(`[data-item="${id}"]`)?.focus({ preventScroll: true });
  }

  #row(item) {
    const text = escapeHtml(item.text);
    const bought = Boolean(item.boughtBy);
    const user = USERS[item.boughtBy];
    return `<li class="shop-item">
      <button class="shop-row" type="button" data-item="${item.id}" aria-pressed="${bought}" aria-label="${text}, ${bought ? `comprado por ${user.name}` : 'pendiente'}">
        <span class="shop-mark">${icon('check')}</span>
        <span class="shop-text">${text}</span>
        ${bought ? `<span class="shop-who" title="Comprado por ${user.name}">${avatar(user)}</span>` : '<span></span>'}
      </button>
    </li>`;
  }

  render() {
    const { pending, bought } = this.#shopping.counts();
    $('#shop-note').textContent = `${pending} por comprar · ${bought} ${bought === 1 ? 'comprado' : 'comprados'}`;
    $('#shop-clear').disabled = pending + bought === 0;
    const items = this.#shopping.list(this.#filter);
    $('#shop-list').innerHTML = items.length ? items.map((i) => this.#row(i)).join('')
      : `<li class="empty">${ShoppingView.#EMPTY[this.#filter]}</li>`;
  }
}

class GoodbyeScreen {
  static #HAIR = {
    fortachona: {
      back: '<path fill="var(--hair-a)" d="M100 20C50 20 18 60 20 110c1 30-6 50-10 70 20 10 40 6 52-6h76c12 12 32 16 52 6-4-20-11-40-10-70 2-50-30-90-80-90z"/>',
      front: '<path fill="var(--hair-a)" d="M30 98C34 56 62 32 100 32s66 24 70 66c-20-18-44-26-70-26s-50 8-70 26z"/>',
      skin: 'var(--skin-a)', ink: 'var(--hair-a)',
    },
    fortachon: {
      back: '',
      front: '<path fill="var(--hair-b)" d="M26 100C20 50 58 22 100 22s80 28 74 78c-14-16-40-28-74-28s-60 12-74 28z"/>',
      skin: 'var(--skin-b)', ink: 'var(--hair-b)',
    },
  };
  #dialog; #auth; #toast; #onLeave;

  constructor({ dialog, auth, toast, onLeave }) {
    this.#dialog = dialog; this.#auth = auth; this.#toast = toast; this.#onLeave = onLeave;
    this.#paintRain($('#goodbye-rain'));
    $('#goodbye-stay').addEventListener('click', () => this.#stay());
    $('#goodbye-leave').addEventListener('click', () => this.#leave());
  }

  #paintRain(container, count = 70) {
    const random = (min, max) => min + Math.random() * (max - min);
    container.innerHTML = Array.from({ length: count }, () => {
      const duration = random(0.7, 1.5);
      return `<i style="--x:${random(0, 100).toFixed(1)}%;--y:${random(0, 95).toFixed(1)}%;--h:${random(14, 30).toFixed(0)}px;--o:${random(0.25, 0.65).toFixed(2)};--d:${duration.toFixed(2)}s;--delay:${(-random(0, duration)).toFixed(2)}s"></i>`;
    }).join('');
  }

  #sadFace(user) {
    const look = GoodbyeScreen.#HAIR[user.id];
    return `<svg class="goodbye-face" viewBox="0 0 200 200" role="img" aria-label="Cara triste de ${user.name}">
      ${look.back}
      <circle cx="100" cy="105" r="72" fill="${look.skin}"/>
      ${look.front}
      <path d="M58 92l28-13M142 92l-28-13" fill="none" stroke="${look.ink}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="74" cy="108" r="7.500" fill="${look.ink}"/>
      <circle cx="126" cy="108" r="7.500" fill="${look.ink}"/>
      <path d="M76 156q24-24 48 0" fill="none" stroke="var(--lip)" stroke-width="6" stroke-linecap="round"/>
      <path class="tear" d="M70 118c5 8 8 12 8 16a8 8 0 0 1-16 0c0-4 3-8 8-16z"/>
      <path class="tear tear-late" d="M130 118c5 8 8 12 8 16a8 8 0 0 1-16 0c0-4 3-8 8-16z"/>
    </svg>`;
  }

  open() {
    $('#goodbye-face').innerHTML = this.#sadFace(partnerOf(this.#auth.current));
    this.#dialog.showModal();
  }

  #stay() {
    this.#dialog.close();
    this.#toast.show('Sabía que te quedarías');
  }

  #leave() {
    this.#dialog.close();
    this.#onLeave();
  }
}

class NotificationCenter {
  #dialog; #notifications; #tasks; #auth; #onOpenTask;

  constructor({ dialog, notifications, tasks, auth, onOpenTask }) {
    this.#dialog = dialog; this.#notifications = notifications; this.#tasks = tasks; this.#auth = auth; this.#onOpenTask = onOpenTask;
    $('#bell').addEventListener('click', () => this.#open());
    $('#notif-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    $('#notif-read-all').addEventListener('click', () => {
      this.#notifications.markAllRead(this.#auth.current.id);
      this.#renderList();
      this.refresh();
    });
    $('#notif-list').addEventListener('click', (e) => this.#onItemClick(e));
  }

  refresh() {
    const user = this.#auth.current;
    if (!user) return;
    const count = this.#notifications.unreadCount(user.id);
    const badge = $('#bell-badge');
    badge.hidden = count === 0;
    badge.textContent = count > 9 ? '9+' : String(count);
    $('#bell').setAttribute('aria-label', count === 1 ? 'Notificaciones, 1 sin leer' : `Notificaciones, ${count} sin leer`);
  }

  #open() {
    this.#renderList();
    this.#dialog.showModal();
  }

  #renderList() {
    const items = this.#notifications.forUser(this.#auth.current.id);
    $('#notif-read-all').hidden = !items.some((n) => !n.read);
    $('#notif-list').innerHTML = items.length ? items.map((n) => this.#item(n)).join('')
      : '<li class="empty">Sin notificaciones por ahora.</li>';
  }

  #item(notification) {
    const task = this.#tasks.find(notification.taskId);
    const actor = USERS[task.author];
    return `<li><button class="notif-item" type="button" data-notification="${notification.id}" data-task-id="${task.id}" data-unread="${!notification.read}">
      ${avatar(actor)}
      <span>
        <span class="notif-text">${actor.name} agregó ${escapeHtml(task.title)}</span>
        <span class="notif-meta">Nidito de amor · ${Format.dayMonth(task.date)}</span>
      </span>
      ${notification.read ? '<span></span>' : '<span class="notif-dot" title="Sin leer"></span>'}
    </button></li>`;
  }

  #onItemClick(event) {
    const item = event.target.closest('[data-notification]');
    if (!item) return;
    this.#notifications.markRead(Number(item.dataset.notification));
    this.#dialog.close();
    this.#onOpenTask(Number(item.dataset.taskId));
  }
}

class NavDrawer {
  constructor(dialog) {
    $('#menu-open').addEventListener('click', () => dialog.showModal());
    $('#menu-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-tab], #logout')) dialog.close();
    });
  }
}

class SwipeNavigator {
  static #MOUSE_IGNORE = 'input, textarea, select, .switch';
  static #START = 10;
  #root; #neighbors; #prepare; #commit;
  #gesture = null; #animating = false; #swallowClick = false;
  #reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor({ root, neighbors, prepare, commit }) {
    this.#root = root; this.#neighbors = neighbors; this.#prepare = prepare; this.#commit = commit;
    root.addEventListener('pointerdown', (e) => this.#down(e));
    root.addEventListener('pointermove', (e) => this.#move(e));
    root.addEventListener('pointerup', (e) => this.#up(e));
    root.addEventListener('pointercancel', () => this.#cancel());
    root.addEventListener('dragstart', (e) => e.preventDefault());
    root.addEventListener('click', (e) => {
      if (this.#swallowClick) { e.preventDefault(); e.stopPropagation(); this.#swallowClick = false; }
    }, true);
  }

  #down(e) {
    if (this.#animating || !e.isPrimary || e.button !== 0) return;
    if (e.pointerType === 'mouse' && e.target.closest(SwipeNavigator.#MOUSE_IGNORE)) return;
    this.#gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dragging: false, peer: null, peerRoute: null };
    if (e.pointerType === 'mouse') this.#root.classList.add('mouse-down');
  }

  #move(e) {
    const g = this.#gesture;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.dragging) {
      if (Math.abs(dy) > SwipeNavigator.#START && Math.abs(dy) >= Math.abs(dx)) { this.#clear(); return; }
      if (Math.abs(dx) <= SwipeNavigator.#START || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      g.dragging = true;
      g.active = this.#neighbors().active;
      this.#root.setPointerCapture(g.id);
      this.#root.classList.add('dragging');
    }
    g.dx = dx;
    this.#paint(dx);
  }

  #paint(dx) {
    const g = this.#gesture;
    const { before, after } = this.#neighbors();
    const route = dx < 0 ? after : before;
    if (route !== g.peerRoute) this.#setPeer(route);
    const width = this.#root.clientWidth;
    const shift = route ? dx : dx * 0.25;
    g.active.style.transform = `translateX(${shift}px)`;
    if (g.peer) g.peer.style.transform = `translateX(${shift + (dx < 0 ? width : -width)}px)`;
  }

  #setPeer(route) {
    const g = this.#gesture;
    if (g.peer) this.#releasePeer(g.peer);
    g.peerRoute = route;
    g.peer = route ? this.#prepare(route) : null;
    if (!g.peer) return;
    const top = Math.max(0, window.scrollY - (this.#root.getBoundingClientRect().top + window.scrollY));
    g.peer.classList.add('swipe-peer');
    g.peer.style.top = `${top}px`;
    g.peer.hidden = false;
  }

  #releasePeer(peer) {
    peer.classList.remove('swipe-peer', 'swipe-anim');
    peer.style.transform = '';
    peer.style.top = '';
    peer.hidden = true;
  }

  #up(e) {
    const g = this.#gesture;
    if (!g || e.pointerId !== g.id) return;
    if (!g.dragging) { this.#clear(); return; }
    this.#swallowClick = true;
    setTimeout(() => { this.#swallowClick = false; }, 60);
    const speed = Math.abs(g.dx) / Math.max(1, e.timeStamp - g.t);
    const go = g.peer && (Math.abs(g.dx) > this.#root.clientWidth * 0.22 || (speed > 0.5 && Math.abs(g.dx) > 30));
    this.#settle(go);
  }

  #cancel() {
    if (this.#gesture?.dragging) this.#settle(false); else this.#clear();
  }

  #settle(go) {
    const g = this.#gesture;
    const width = this.#root.clientWidth;
    const finish = () => {
      if (go) this.#commit(g.peerRoute);
      g.active.classList.remove('swipe-anim');
      g.active.style.transform = '';
      if (g.peer) {
        const peer = g.peer;
        peer.classList.remove('swipe-peer', 'swipe-anim');
        peer.style.transform = '';
        peer.style.top = '';
        if (!go) peer.hidden = true;
      }
      this.#animating = false;
    };
    this.#clear();
    this.#animating = true;
    if (this.#reduced.matches) { finish(); return; }
    [g.active, g.peer].forEach((el) => el && el.classList.add('swipe-anim'));
    const direction = g.dx < 0 ? -1 : 1;
    g.active.style.transform = go ? `translateX(${direction * width}px)` : '';
    if (g.peer) g.peer.style.transform = go ? 'translateX(0)' : `translateX(${-direction * width}px)`;
    setTimeout(finish, 230);
  }

  #clear() {
    this.#gesture = null;
    this.#root.classList.remove('mouse-down', 'dragging');
  }
}

/* ---------- Aplicación: une las piezas y resuelve la navegación ---------- */
class App {
  #auth; #views; #toast; #goodbye; #center; #notifications; #lastRoute = null;
  static #ROUTES = ['mantenedor', 'historico', 'cuentas', 'nidito', 'superduper'];

  constructor({ auth, views, toast, goodbye, center, notifications }) {
    this.#auth = auth; this.#views = views; this.#toast = toast; this.#goodbye = goodbye;
    this.#center = center; this.#notifications = notifications;
    window.addEventListener('hashchange', () => this.route());
    $('#logout').addEventListener('click', () => this.#goodbye.open());
  }

  onLogin() {
    const user = this.#auth.current;
    $('#who-avatar').innerHTML = avatar(user);
    $('#drawer-avatar').innerHTML = avatar(user);
    $('#who-name').textContent = user.name;
    document.querySelectorAll('[data-as-user]').forEach((el) => { el.innerHTML = `${avatar(user)}<span>Se guardará a nombre de ${user.name}</span>`; });
    const unread = this.#notifications.unreadCount(user.id);
    this.#toast.show(unread === 0 ? `Hola, ${user.name}`
      : `Hola, ${user.name}. ${unread === 1 ? 'Tienes 1 notificación nueva' : `Tienes ${unread} notificaciones nuevas`}.`);
    this.route();
  }

  refresh() { this.route(); }

  neighbors() {
    const routes = App.#ROUTES;
    const route = this.#lastRoute;
    const index = routes.indexOf(route);
    return { active: $(`#view-${route}`), before: routes[index - 1] || null, after: routes[index + 1] || null };
  }

  prepareView(route) {
    this.#views[route].render();
    return $(`#view-${route}`);
  }

  goTo(route) {
    location.hash = route;
    this.route();
  }

  logout() {
    this.#auth.logout();
    this.route();
  }

  route() {
    const loggedIn = Boolean(this.#auth.current);
    $('#login-view').hidden = loggedIn;
    $('#app').hidden = !loggedIn;
    if (!loggedIn) return;
    this.#center.refresh();

    const hash = location.hash.slice(1);
    const route = App.#ROUTES.includes(hash) ? hash : 'cuentas';
    App.#ROUTES.forEach((name) => { $(`#view-${name}`).hidden = name !== route; });
    document.querySelectorAll('[data-tab]').forEach((tab) => {
      if (tab.dataset.tab === route) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    $('#page-dots').innerHTML = App.#ROUTES.map((name) => `<span class="page-dot" data-on="${name === route}"></span>`).join('');
    this.#views[route].render();
    if (route !== this.#lastRoute) window.scrollTo(0, 0);
    this.#lastRoute = route;
  }
}

/* ---------- Bootstrap (único punto de entrada) ---------- */
let _initialized = false;

export function bootstrap() {
  if (_initialized) return;
  _initialized = true;

  new ThemeController();
  new HeartRain($('#rain'));

  const auth = new AuthService(USERS, SHARED_PASSWORD, new SessionStore());
  const toast = new Toast($('#toast'));
  const accountRepo = new InMemoryRepository(SampleData.accounts());
  const accounts = new AccountService(accountRepo);
  const expenses = new ExpenseService(new InMemoryRepository(SampleData.expenses(accounts.all())));
  const tasks = new TaskService(new InMemoryRepository(SampleData.tasks()));
  const notifications = new NotificationService(new InMemoryRepository(SampleData.notifications(tasks.list())));
  tasks.onAdded((task) => notifications.notifyPartner(task));
  tasks.onRemoved((taskId) => notifications.removeForTask(taskId));
  const shopping = new ShoppingService(new InMemoryRepository(SampleData.shopping()));
  const taskModal = new TaskModal({ dialog: $('#task-modal'), tasks, auth, toast, onSaved: () => app.refresh() });
  const taskDetail = new TaskDetailModal({ dialog: $('#task-detail'), tasks, toast, onEdit: (id) => taskModal.open(id), onDeleted: () => app.refresh() });
  const shopChanged = () => app.refresh();
  const shopEdit = new ShoppingEditModal({ dialog: $('#shop-modal'), shopping, toast, onChanged: shopChanged });
  const shopClear = new ShoppingClearModal({ dialog: $('#clear-modal'), shopping, toast, onChanged: shopChanged });
  const modal = new ExpenseModal({ dialog: $('#expense-modal'), accounts, expenses, auth, toast, onSaved: () => app.refresh() });
  const data = { accounts, expenses, modal };
  const goodbye = new GoodbyeScreen({ dialog: $('#goodbye'), auth, toast, onLeave: () => app.logout() });
  const center = new NotificationCenter({
    dialog: $('#notifications'), notifications, tasks, auth,
    onOpenTask: (taskId) => { app.goTo('nidito'); taskDetail.open(taskId); },
  });
  const app = new App({
    auth, toast, goodbye, center, notifications,
    views: {
      cuentas: new CurrentExpensesView(data),
      historico: new HistoryView(data),
      nidito: new TasksView({ tasks, modal: taskModal, detail: taskDetail }),
      mantenedor: new AccountsView({ accounts, expenses, toast }),
      superduper: new ShoppingView({ shopping, auth, editModal: shopEdit, clearModal: shopClear }),
    },
  });
  new NavDrawer($('#nav-drawer'));
  new SwipeNavigator({
    root: $('#views'),
    neighbors: () => app.neighbors(),
    prepare: (route) => app.prepareView(route),
    commit: (route) => app.goTo(route),
  });
  new LoginView({ auth, onSuccess: () => app.onLogin() });
  if (auth.restore()) app.onLogin(); else app.route();
}
