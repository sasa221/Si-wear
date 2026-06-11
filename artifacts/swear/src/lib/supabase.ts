const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn(
    '[S! Wear] ⚠️  Supabase not configured. Orders are stored in localStorage only — ' +
    'they will NOT be visible to admin from other devices. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable production order storage.'
  );
}

type DbRow = Record<string, unknown>;
type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: supabaseAnonKey!,
    Authorization: `Bearer ${supabaseAnonKey!}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
}

function buildUrl(table: string, filters: string[], orderClause: string, selectCols: string): string {
  const parts: string[] = [`select=${encodeURIComponent(selectCols)}`];
  for (const f of filters) parts.push(f);
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
      const headers = baseHeaders(this.isSingle ? { Accept: 'application/vnd.pgjson' } : undefined);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: (err as { message?: string }).message ?? res.statusText } };
      }
      const data = (await res.json()) as T;
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
        return { data: null, error: { message: (err as { message?: string }).message ?? res.statusText } };
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
        return { data: null, error: { message: (err as { message?: string }).message ?? res.statusText } };
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
