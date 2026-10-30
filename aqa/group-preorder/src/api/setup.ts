import { ApiClient, type JsonRecord } from './client';

export interface BookedGroup {
  reservationId: string;
  groupId: string;
  tableNumber: number;
  locationId: string;
}

export interface GuestSession {
  sessionId: string;
  sessionToken: string;
  guestName: string;
}

export interface DishRef {
  id: string;
  name: string;
}

export interface PreparedCarts {
  booking: BookedGroup;
  sharedDish: DishRef;
  excludedDish: DishRef;
  sharedQuantity: number;
}

export async function bookGroup(
  api: ApiClient,
  ownerToken: string,
  guestCount: number,
  title: string,
  parallelIndex: number,
): Promise<BookedGroup> {
  const locations = await api.locations();
  const errors: string[] = [];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slot = timeSlot(title, parallelIndex, attempt);
    for (const location of locations) {
      const locationId = stringValue(location, 'id', 'Id');
      if (!locationId) continue;
      const tables = await api.availableTables(locationId, guestCount, slot.start);
      const table = tables.find((item) => numberValue(item, 'capacity', 'Capacity') >= guestCount);
      if (!table) continue;
      const tableId = stringValue(table, 'id', 'Id');
      if (!tableId) continue;

      const created = await api.send('POST', '/reservations', {
        token: ownerToken,
        body: { tableId, startTime: slot.start, endTime: slot.end, guestCount },
      });
      if (created.status !== 201 && created.status !== 200) {
        errors.push(`${slot.start} ${tableId}: ${created.status} ${JSON.stringify(created.body)}`);
        continue;
      }

      const reservationId = stringValue(created.body, 'id', 'Id');
      if (!reservationId) {
        throw new Error(`Reservation created without an id: ${JSON.stringify(created.body)}`);
      }

      try {
        const invite = await api.inviteToken(ownerToken, reservationId);
        const group = await api.groupIdByInvite(invite);
        return { reservationId, groupId: group.groupId, tableNumber: group.tableNumber, locationId };
      } catch (error) {
        await api.cancelReservation(ownerToken, reservationId);
        throw error;
      }
    }
  }

  throw new Error(
    `No free table for ${guestCount} guests. ${errors.slice(-5).join(' | ') || 'available-tables returned nothing.'}`,
  );
}

export async function addSubmittedGuest(
  api: ApiClient,
  groupId: string,
  guestName: string,
  dishId: string,
  quantity: number,
): Promise<GuestSession> {
  const guest = await api.createGuest(groupId, guestName);
  const session = { ...guest, guestName };
  await api.addDish(session.sessionId, session.sessionToken, dishId, quantity);
  await api.submitCart(session.sessionId, session.sessionToken);
  return session;
}

/** Two submitted carts share one dish; a third cart keeps a different dish unsubmitted. */
export async function prepareMergedCarts(
  api: ApiClient,
  ownerToken: string,
  title: string,
  parallelIndex: number,
): Promise<PreparedCarts> {
  const booking = await bookGroup(api, ownerToken, 6, title, parallelIndex);
  try {
    const dishes = availableDishes(await api.dishes(booking.locationId));
    if (dishes.length < 2) {
      throw new Error(`Location ${booking.locationId} needs two available dishes.`);
    }
    const sharedDish = dishes[0];
    const excludedDish = dishes[1];
    await addSubmittedGuest(api, booking.groupId, 'Kateryna', sharedDish.id, 1);
    await addSubmittedGuest(api, booking.groupId, 'Mariia', sharedDish.id, 2);
    const pending = await api.createGuest(booking.groupId, 'Olena');
    await api.addDish(pending.sessionId, pending.sessionToken, excludedDish.id, 1);
    await api.createOrder(ownerToken, booking.reservationId, sharedDish.id);
    return { booking, sharedDish, excludedDish, sharedQuantity: 3 };
  } catch (error) {
    await api.cancelReservation(ownerToken, booking.reservationId);
    throw error;
  }
}

export function availableDishes(dishes: JsonRecord[]): DishRef[] {
  return dishes
    .filter((dish) => {
      const state = stringValue(dish, 'state', 'State');
      return state === 'Available' || state === '1';
    })
    .map((dish) => ({
      id: stringValue(dish, 'id', 'Id') ?? '',
      name: stringValue(dish, 'name', 'Name') ?? '',
    }))
    .filter((dish) => dish.id && dish.name);
}

export function orderQuantity(order: JsonRecord, dishId: string): number {
  const items = order.orderItems ?? order.OrderItems;
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    if (!item || typeof item !== 'object') return sum;
    const record = item as JsonRecord;
    const dish = (record.dish ?? record.Dish) as JsonRecord | undefined;
    const id = dish ? stringValue(dish, 'id', 'Id') : stringValue(record, 'dishId', 'DishId');
    const quantity = numberValue(record, 'quantity', 'Quantity');
    return id === dishId ? sum + quantity : sum;
  }, 0);
}

function timeSlot(title: string, parallelIndex: number, attempt: number): { start: string; end: string } {
  const day = 5 + parallelIndex * 40 + attempt * 3 + (hash(title) % 3);
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + day);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

function stringValue(body: unknown, ...keys: string[]): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as JsonRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function numberValue(body: unknown, ...keys: string[]): number {
  if (!body || typeof body !== 'object') return 0;
  const record = body as JsonRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
  }
  return 0;
}
