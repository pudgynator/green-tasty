import { requireEnv } from '../config/env';

export interface ApiResult {
  status: number;
  body: unknown;
}

export const OrderStatus = {
  Created: 0,
  Submitted: 1,
  Cancelled: 2,
  SubmittedByCustomer: 3,
} as const;

export class ApiClient {
  readonly baseUrl = requireEnv('API_BASE_URL');

  async send(method: string, path: string, options?: { token?: string; body?: unknown }): Promise<ApiResult> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options?.token) headers.Authorization = `Bearer ${options.token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }

    return { status: response.status, body };
  }

  async ok(method: string, path: string, options?: { token?: string; body?: unknown }): Promise<unknown> {
    const result = await this.send(method, path, options);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`${method} ${path} failed with ${result.status}: ${JSON.stringify(result.body)}`);
    }
    return result.body;
  }

  signIn(email: string, password: string): Promise<string> {
    return this.ok('POST', '/signin', { body: { email, password } }).then((body) =>
      textField(body, 'idToken'),
    );
  }

  registerCustomer(email: string, password: string): Promise<void> {
    return this.ok('POST', '/register', {
      body: {
        firstName: 'Aqa',
        lastName: 'Guest',
        email,
        password,
        confirmPassword: password,
      },
    }).then(() => undefined);
  }

  locations(): Promise<JsonRecord[]> {
    return this.ok('GET', '/locations').then(asRecords);
  }

  availableTables(locationId: string, capacity: number, startTime: string): Promise<JsonRecord[]> {
    const query = new URLSearchParams({ locationId, capacity: String(capacity), startTime });
    return this.ok('GET', `/available-tables?${query}`).then(asRecords);
  }

  dishes(locationId: string): Promise<JsonRecord[]> {
    return this.ok('GET', `/locations/${encodeURIComponent(locationId)}/dishes`).then(asRecords);
  }

  createReservation(
    token: string,
    tableId: string,
    startTime: string,
    endTime: string,
    guestCount: number,
  ): Promise<string> {
    return this.ok('POST', '/reservations', {
      token,
      body: { tableId, startTime, endTime, guestCount },
    }).then((body) => textField(body, 'id'));
  }

  cancelReservation(token: string, reservationId: string): Promise<ApiResult> {
    return this.send('DELETE', '/reservations', { token, body: { id: reservationId } });
  }

  inviteToken(token: string, reservationId: string): Promise<string> {
    return this.ok('GET', `/reservations/${encodeURIComponent(reservationId)}/invite-token`, { token }).then(
      (body) => textField(body, 'token'),
    );
  }

  groupIdByInvite(inviteToken: string): Promise<{ groupId: string; tableNumber: number }> {
    return this.ok('GET', `/guest/invites/${encodeURIComponent(inviteToken)}`).then((body) => ({
      groupId: textField(body, 'GroupReservationId', 'groupReservationId'),
      tableNumber: numberField(body, 'TableNumber', 'tableNumber'),
    }));
  }

  createGuest(groupId: string, guestName: string): Promise<{ sessionId: string; sessionToken: string }> {
    return this.ok('POST', '/guest/sessions', {
      body: { groupReservationId: groupId, guestName },
    }).then((body) => ({
      sessionId: textField(body, 'SessionId', 'sessionId'),
      sessionToken: textField(body, 'SessionToken', 'sessionToken'),
    }));
  }

  addDish(sessionId: string, sessionToken: string, dishId: string, quantity: number): Promise<void> {
    return this.ok('POST', `/guest/sessions/${encodeURIComponent(sessionId)}/dishes`, {
      token: sessionToken,
      body: { dishId, quantity },
    }).then(() => undefined);
  }

  removeDish(sessionId: string, sessionToken: string, dishId: string, quantity: number): Promise<void> {
    return this.ok('DELETE', `/guest/sessions/${encodeURIComponent(sessionId)}/dishes`, {
      token: sessionToken,
      body: { dishId, quantity },
    }).then(() => undefined);
  }

  submitCart(sessionId: string, sessionToken: string): Promise<void> {
    return this.ok('POST', `/guest/sessions/${encodeURIComponent(sessionId)}/submit`, {
      token: sessionToken,
    }).then(() => undefined);
  }

  createOrder(token: string, reservationId: string, dishId: string): Promise<void> {
    return this.ok('POST', '/orders', {
      token,
      body: { reservationId, orderItems: [{ dishId, quantity: 1 }] },
    }).then(() => undefined);
  }

  getOrder(token: string, reservationId: string): Promise<JsonRecord> {
    return this.ok('GET', `/orders/${encodeURIComponent(reservationId)}`, { token }).then(asRecord);
  }

  submitGroup(token: string | undefined, groupId: string, reservationId: string): Promise<ApiResult> {
    return this.send('POST', `/group-reservations/${encodeURIComponent(groupId)}/submit`, {
      token,
      body: { reservationId },
    });
  }
}

export type JsonRecord = Record<string, unknown>;

export function asRecord(body: unknown): JsonRecord {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as JsonRecord;
  throw new Error(`Expected an object, got ${JSON.stringify(body)}`);
}

export function asRecords(body: unknown): JsonRecord[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (isRecord(body)) {
    for (const value of Object.values(body)) {
      if (Array.isArray(value)) return value.filter(isRecord);
    }
  }
  return [];
}

export function textField(body: unknown, ...keys: string[]): string {
  const record = asRecord(body);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value) return value;
  }
  throw new Error(`Missing ${keys.join(' or ')} in ${JSON.stringify(body)}`);
}

export function numberField(body: unknown, ...keys: string[]): number {
  const record = asRecord(body);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
  }
  return 0;
}

export function errorText(body: unknown): string {
  if (!isRecord(body)) return typeof body === 'string' ? body : JSON.stringify(body);
  const value = body.message ?? body.Message ?? body.error ?? body.Error ?? '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function errorCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const value = body.errorCode ?? body.ErrorCode;
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
