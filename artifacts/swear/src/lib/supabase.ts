function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const AUTH_SESSION_KEY = 'swear_supabase_auth_session';

export const isDevelopmentMode = import.meta.env.DEV;
export const SUPABASE_NOT_CONNECTED_MESSAGE = 'Supabase is not connected. Orders will not reach admin.';
export const DATABASE_TABLE_MISSING_MESSAGE = 'Database table missing. Run the migration file.';

function hasRealEnvValue(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ![
    '<your',
    'your_supabase',
    'your supabase',
    'supabase_project_url',
    'supabase anon',
  ].some(placeholder => normalized.includes(placeholder));
}

export const supabaseConfigured = hasRealEnvValue(supabaseUrl) && hasRealEnvValue(supabaseAnonKey);
export const useDevOrderMock = isDevelopmentMode && !supabaseConfigured;

console.log('[S! Wear] Supabase URL loaded:', supabaseUrl || 'missing');

if (!supabaseConfigured) {
  console.warn(`[S! Wear] ${SUPABASE_NOT_CONNECTED_MESSAGE}`);
}

type DbRow = Record<string, unknown>;
type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  phone?: string;
  identities?: unknown[];
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: SupabaseAuthUser;
}

export interface SupabaseAuthSignUpResult {
  session: SupabaseAuthSession | null;
  user: SupabaseAuthUser | null;
  emailAlreadyRegistered: boolean;
}

let supabaseAccessToken: string | null = (() => {
  if (!supabaseConfigured || typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SupabaseAuthSession>;
    return typeof parsed.accessToken === 'string' ? parsed.accessToken : null;
  } catch {
    return null;
  }
})();

export function getSupabaseAccessToken(): string | null {
  return supabaseAccessToken;
}

export function setSupabaseAccessToken(token: string | null): void {
  supabaseAccessToken = token;
}

export function getStoredSupabaseAuthSession(): SupabaseAuthSession | null {
  if (!supabaseConfigured) return null;
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SupabaseAuthSession;
    if (!parsed.accessToken || !parsed.user?.id) return null;
    setSupabaseAccessToken(parsed.accessToken);
    return parsed;
  } catch {
    return null;
  }
}

export function saveSupabaseAuthSession(session: SupabaseAuthSession): void {
  setSupabaseAccessToken(session.accessToken);
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearSupabaseAuthSession(): void {
  setSupabaseAccessToken(null);
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function parseErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length > 0) return parts.join(' ');
  }
  return fallback;
}

export function isMissingSupabaseTableError(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('pgrst205') ||
    normalized.includes('could not find the table') ||
    normalized.includes('schema cache') ||
    normalized.includes('relation') && normalized.includes('does not exist');
}

export function formatSupabaseError(message: string, table?: string): string {
  if (!isMissingSupabaseTableError(message)) return message;
  const tableText = table ? ` (${table})` : '';
  return `${DATABASE_TABLE_MISSING_MESSAGE}${tableText}`;
}

export function logSupabaseTableError(table: string, message: string): void {
  if (isMissingSupabaseTableError(message)) {
    console.error(`[S! Wear] Database table missing: ${table}. Original Supabase error:`, message);
  }
}

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: supabaseAnonKey!,
    Authorization: `Bearer ${supabaseAccessToken || supabaseAnonKey!}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
}

function authHeaders(accessToken?: string): Record<string, string> {
  return {
    apikey: supabaseAnonKey!,
    Authorization: `Bearer ${accessToken || supabaseAccessToken || supabaseAnonKey!}`,
    'Content-Type': 'application/json',
  };
}

function authUrl(path: string): string {
  return `${supabaseUrl}/auth/v1${path}`;
}

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');
  return base ? `${base}/api${path}` : `/api${path}`;
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

function normalizeAuthSession(payload: Record<string, any>): SupabaseAuthSession | null {
  const session = payload.session ?? payload;
  const accessToken = session.access_token;
  const refreshToken = session.refresh_token;
  const user = session.user ?? payload.user;
  if (!accessToken || !user?.id) return null;
  const expiresAt = session.expires_at ??
    (typeof session.expires_in === 'number' ? Math.floor(Date.now() / 1000) + session.expires_in : undefined);
  return {
    accessToken,
    refreshToken,
    expiresAt,
    user,
  };
}

function normalizeAuthUser(payload: Record<string, any>): SupabaseAuthUser | null {
  const user = payload.user ?? payload.session?.user ?? payload;
  return user?.id ? user : null;
}

async function authFetch(path: string, init: RequestInit): Promise<Record<string, any>> {
  if (!supabaseConfigured) throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
  const res = await fetch(authUrl(path), init);
  const text = await res.text();
  const payload = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(parseErrorMessage(payload, res.statusText));
  }
  return payload;
}

async function apiFetch(path: string, init: RequestInit): Promise<Record<string, any>> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new Error('Signup API is not reachable. Start the API server and try again.');
  }

  const text = await res.text();
  let payload: Record<string, any> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!res.ok) {
    throw new Error(parseErrorMessage(payload, res.statusText));
  }

  return payload;
}

export async function supabaseAuthSignUp(
  email: string,
  password: string,
  metadata: Record<string, unknown>
): Promise<SupabaseAuthSignUpResult> {
  const payload = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      fullName: metadata.full_name,
      phone: metadata.phone,
    }),
  });
  const session = normalizeAuthSession(payload);
  const user = session?.user ?? normalizeAuthUser(payload);
  if (session) saveSupabaseAuthSession(session);
  return {
    session,
    user,
    emailAlreadyRegistered: !session && !!user && Array.isArray(user.identities) && user.identities.length === 0,
  };
}

export async function supabaseAuthSignInWithPassword(
  email: string,
  password: string
): Promise<SupabaseAuthSession> {
  const payload = await authFetch('/token?grant_type=password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const session = normalizeAuthSession(payload);
  if (!session) throw new Error('Supabase did not return a login session.');
  saveSupabaseAuthSession(session);
  return session;
}

export async function supabaseAuthRefreshSession(refreshToken: string): Promise<SupabaseAuthSession> {
  const payload = await authFetch('/token?grant_type=refresh_token', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const session = normalizeAuthSession(payload);
  if (!session) throw new Error('Supabase did not return a refreshed session.');
  saveSupabaseAuthSession(session);
  return session;
}

export async function supabaseAuthGetUser(accessToken = supabaseAccessToken): Promise<SupabaseAuthUser | null> {
  if (!accessToken) return null;
  const payload = await authFetch('/user', {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  return payload as SupabaseAuthUser;
}

export async function supabaseAuthSignOut(): Promise<void> {
  if (!supabaseAccessToken) {
    clearSupabaseAuthSession();
    return;
  }
  try {
    await authFetch('/logout', {
      method: 'POST',
      headers: authHeaders(supabaseAccessToken),
    });
  } finally {
    clearSupabaseAuthSession();
  }
}

export function getSupabasePublicStorageUrl(bucket: string, path: string): string {
  if (!supabaseConfigured) throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`;
}

export async function uploadSupabaseStorageObject(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string
): Promise<string> {
  if (!supabaseConfigured) throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
  if (bucket === 'product-images') {
    if (!supabaseAccessToken) {
      throw new Error('Admin login is required to upload images. Sign in to the admin panel again.');
    }

    let res: Response;
    try {
      res = await fetch(apiUrl('/storage/product-images'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
          'Content-Type': contentType,
          'x-storage-path': path,
        },
        body: file,
      });
    } catch {
      throw new Error('Image upload API is not reachable. Start the API server and try again.');
    }

    const text = await res.text();
    let payload: Record<string, any> = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }

    if (!res.ok) {
      throw new Error(parseErrorMessage(payload, res.statusText));
    }

    if (typeof payload.publicUrl !== 'string') {
      throw new Error('Image upload API did not return a public URL.');
    }

    return payload.publicUrl;
  }

  const res = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey!,
      Authorization: `Bearer ${supabaseAccessToken || supabaseAnonKey!}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseErrorMessage(err, res.statusText));
  }

  return getSupabasePublicStorageUrl(bucket, path);
}

export async function supabaseRpc<T = DbRow>(
  functionName: string,
  body: DbRow
): DbResult<T> {
  if (!supabaseConfigured) {
    return { data: null, error: { message: SUPABASE_NOT_CONNECTED_MESSAGE } };
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: { message: parseErrorMessage(err, res.statusText) } };
    }
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T) : null;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: String(e) } };
  }
}

function buildUrl(table: string, filters: string[], orderClause: string, selectCols: string): string {
  const parts: string[] = [`select=${encodeURIComponent(selectCols)}`];
  for (const filter of filters) parts.push(filter);
  if (orderClause) parts.push(`order=${orderClause}`);
  return `${supabaseUrl}/rest/v1/${table}?${parts.join('&')}`;
}

class SelectBuilder<T = DbRow> {
  private filters: string[] = [];
  private orderClause = '';
  private isSingle = false;

  constructor(private table: string, private cols: string) {}

  eq(col: string, val: string | boolean): this {
    this.filters.push(`${col}=eq.${encodeURIComponent(String(val))}`);
    return this;
  }

  in(col: string, values: string[]): this {
    this.filters.push(`${col}=in.(${values.map(value => encodeURIComponent(value)).join(',')})`);
    return this;
  }

  order(col: string, opts?: { ascending: boolean }): this {
    this.orderClause = `${col}.${opts?.ascending === false ? 'desc' : 'asc'}`;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  then<R>(
    resolve: (value: { data: T | null; error: { message: string } | null }) => R,
    reject?: (reason: unknown) => R
  ): Promise<R> {
    return this.execute().then(resolve, reject);
  }

  private async execute(): DbResult<T> {
    try {
      const url = buildUrl(this.table, this.filters, this.orderClause, this.cols);
      const headers = baseHeaders(this.isSingle ? { Accept: 'application/vnd.pgrst.object+json' } : undefined);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: parseErrorMessage(err, res.statusText) } };
      }
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : null;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: String(e) } };
    }
  }
}

class UpdateBuilder<T = DbRow> {
  private filters: string[] = [];

  constructor(private table: string, private body: DbRow) {}

  eq(col: string, val: string | boolean): this {
    this.filters.push(`${col}=eq.${encodeURIComponent(String(val))}`);
    return this;
  }

  then<R>(
    resolve: (value: { data: T | null; error: { message: string } | null }) => R,
    reject?: (reason: unknown) => R
  ): Promise<R> {
    return this.execute().then(resolve, reject);
  }

  private async execute(): DbResult<T> {
    try {
      const parts = this.filters.length ? this.filters.join('&') : '';
      const url = `${supabaseUrl}/rest/v1/${this.table}${parts ? '?' + parts : ''}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: baseHeaders(),
        body: JSON.stringify(this.body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: parseErrorMessage(err, res.statusText) } };
      }
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : null;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: String(e) } };
    }
  }
}

class TableRef<T = DbRow> {
  constructor(private table: string) {}

  select(cols = '*'): SelectBuilder<T[]> {
    return new SelectBuilder<T[]>(this.table, cols);
  }

  async insert(body: DbRow | DbRow[]): DbResult<T[]> {
    try {
      const url = `${supabaseUrl}/rest/v1/${this.table}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: baseHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: parseErrorMessage(err, res.statusText) } };
      }
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T[]) : [];
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: String(e) } };
    }
  }

  async upsert(body: DbRow | DbRow[], onConflict = 'id'): DbResult<T[]> {
    try {
      const url = `${supabaseUrl}/rest/v1/${this.table}?on_conflict=${encodeURIComponent(onConflict)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: baseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: parseErrorMessage(err, res.statusText) } };
      }
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T[]) : [];
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: String(e) } };
    }
  }

  update(body: DbRow): UpdateBuilder<T[]> {
    return new UpdateBuilder<T[]>(this.table, body);
  }
}

export const supabase = supabaseConfigured
  ? {
      from<T = DbRow>(table: string): TableRef<T> {
        return new TableRef<T>(table);
      },
    }
  : null;

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeChange<T = DbRow> {
  eventType: Exclude<RealtimeEvent, '*'>;
  record: T;
  oldRecord?: Partial<T>;
}

interface RealtimeOptions {
  table: string;
  filter?: string;
  event?: RealtimeEvent;
  channel?: string;
}

let realtimeRef = 1;

function nextRef(): string {
  realtimeRef += 1;
  return String(realtimeRef);
}

function realtimeUrl(): string {
  const wsBase = supabaseUrl!.replace(/^http/i, 'ws');
  return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(supabaseAnonKey!)}&vsn=1.0.0`;
}

function normalizeRealtimePayload<T>(payload: Record<string, any>): RealtimeChange<T> | null {
  const data = payload.data ?? payload;
  const eventType = data.type ?? data.eventType ?? data.event;
  const record = data.record ?? data.new ?? payload.record;
  if (!eventType || !record) return null;

  return {
    eventType,
    record,
    oldRecord: data.old_record ?? data.old,
  } as RealtimeChange<T>;
}

export function subscribeToTableChanges<T = DbRow>(
  options: RealtimeOptions,
  callback: (change: RealtimeChange<T>) => void
): () => void {
  if (!supabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    console.warn(`[S! Wear] Realtime skipped: ${SUPABASE_NOT_CONNECTED_MESSAGE}`);
    return () => {};
  }

  const topic = `realtime:${options.channel || `${options.table}:${options.filter || 'all'}`}`;
  const socket = new WebSocket(realtimeUrl());
  let heartbeatId: number | undefined;
  let closed = false;

  const send = (event: string, payload: Record<string, unknown>, ref = nextRef()) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ topic, event, payload, ref }));
  };

  socket.onopen = () => {
    send('phx_join', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
        postgres_changes: [{
          event: options.event || '*',
          schema: 'public',
          table: options.table,
          ...(options.filter ? { filter: options.filter } : {}),
        }],
      },
      access_token: supabaseAccessToken || supabaseAnonKey,
    });

    heartbeatId = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: nextRef() }));
      }
    }, 25000);
  };

  socket.onmessage = event => {
    try {
      const message = JSON.parse(event.data) as { event?: string; payload?: Record<string, any> };
      if (message.event !== 'postgres_changes' || !message.payload) return;
      const change = normalizeRealtimePayload<T>(message.payload);
      if (change) callback(change);
    } catch (err) {
      console.warn('[S! Wear] Realtime message parse failed:', err);
    }
  };

  socket.onerror = err => {
    console.warn(`[S! Wear] Realtime unavailable for ${options.table}:`, err);
  };

  socket.onclose = () => {
    if (heartbeatId) window.clearInterval(heartbeatId);
    if (!closed) console.warn(`[S! Wear] Realtime closed for ${options.table}.`);
  };

  return () => {
    closed = true;
    if (heartbeatId) window.clearInterval(heartbeatId);
    if (socket.readyState === WebSocket.OPEN) {
      send('phx_leave', {});
    }
    socket.close();
  };
}
