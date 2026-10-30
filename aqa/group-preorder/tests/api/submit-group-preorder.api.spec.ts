import { errorCode, errorText, OrderStatus } from '../../src/api/client';
import { addSubmittedGuest, availableDishes, bookGroup, orderQuantity, prepareMergedCarts } from '../../src/api/setup';
import { expect, test } from '../fixtures';

test.describe('Consolidated pre-order confirmation', { tag: '@level2' }, () => {
  test('rejects a group with no submitted carts', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const result = await api.submitGroup(ownerToken, booking.groupId, booking.reservationId);
      expectFailure(result, 400, 'There are no submitted guest sessions.');
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });

  test('does not allow emptying a cart after it was submitted', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const dish = availableDishes(await api.dishes(booking.locationId))[0];
      expect(dish, 'location has an available dish').toBeTruthy();
      const guest = await addSubmittedGuest(api, booking.groupId, 'Kateryna', dish.id, 1);

      const removed = await api.send('DELETE', `/guest/sessions/${encodeURIComponent(guest.sessionId)}/dishes`, {
        token: guest.sessionToken,
        body: { dishId: dish.id, quantity: 1 },
      });
      expectFailure(removed, 400, 'Guest session is already submitted.');
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });

  test('rejects confirmation when the reservation has no order', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const dish = availableDishes(await api.dishes(booking.locationId))[0];
      expect(dish, 'location has an available dish').toBeTruthy();
      await addSubmittedGuest(api, booking.groupId, 'Kateryna', dish.id, 1);

      const result = await api.submitGroup(ownerToken, booking.groupId, booking.reservationId);
      expectFailure(result, 400, 'Order not found.');
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });

  test('rejects an unknown group', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const result = await api.submitGroup(
        ownerToken,
        '00000000-0000-4000-8000-000000000001',
        booking.reservationId,
      );
      expectFailure(result, 404, 'Group reservation was not found');
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });

  test('rejects an unknown reservation', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const result = await api.submitGroup(
        ownerToken,
        booking.groupId,
        '00000000-0000-4000-8000-000000000002',
      );
      expectFailure(result, 404, 'Reservation not found.');
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });

  test('rejects a reservation that belongs to another group', async ({ api, ownerToken }, testInfo) => {
    const first = await bookGroup(api, ownerToken, 3, `${testInfo.title} first`, testInfo.parallelIndex);
    const second = await bookGroup(api, ownerToken, 3, `${testInfo.title} second`, testInfo.parallelIndex);
    try {
      const result = await api.submitGroup(ownerToken, first.groupId, second.reservationId);
      expectFailure(result, 400, 'Reservation does not belong to this group reservation.');
    } finally {
      await api.cancelReservation(ownerToken, first.reservationId);
      await api.cancelReservation(ownerToken, second.reservationId);
    }
  });

  test('merges submitted dishes and rejects a second confirmation', async ({ api, ownerToken }, testInfo) => {
    const prepared = await prepareMergedCarts(api, ownerToken, testInfo.title, testInfo.parallelIndex);
    try {
      const confirmed = await api.submitGroup(
        ownerToken,
        prepared.booking.groupId,
        prepared.booking.reservationId,
      );
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      expect(confirmed.body).toEqual([
        { dishId: prepared.sharedDish.id, quantity: prepared.sharedQuantity },
      ]);

      const order = await api.getOrder(ownerToken, prepared.booking.reservationId);
      const status = order.status ?? order.Status;
      expect(status === OrderStatus.SubmittedByCustomer || status === 'SubmittedByCustomer').toBeTruthy();
      expect(orderQuantity(order, prepared.sharedDish.id)).toBe(prepared.sharedQuantity);
      expect(orderQuantity(order, prepared.excludedDish.id)).toBe(0);

      const again = await api.submitGroup(ownerToken, prepared.booking.groupId, prepared.booking.reservationId);
      expectFailure(again, 400, 'Group reservation was submitted.', 'GroupReservationSubmitted');
    } finally {
      await api.cancelReservation(ownerToken, prepared.booking.reservationId);
    }
  });

  test('rejects confirmation from another customer', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const email = `aqa.${Date.now()}.${testInfo.parallelIndex}@example.com`;
      const password = 'AqaPass1!';
      await api.registerCustomer(email, password);
      const otherToken = await api.signIn(email, password);

      const result = await api.submitGroup(otherToken, booking.groupId, booking.reservationId);
      expectFailure(result, 403, 'Only the reservation owner can perform this action.');
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });

  test('rejects confirmation without a token', async ({ api, ownerToken }, testInfo) => {
    const booking = await bookGroup(api, ownerToken, 3, testInfo.title, testInfo.parallelIndex);
    try {
      const result = await api.submitGroup(undefined, booking.groupId, booking.reservationId);
      expect(result.status, JSON.stringify(result.body)).toBe(401);
      expect(JSON.stringify(result.body)).toMatch(/unauthorized/i);
    } finally {
      await api.cancelReservation(ownerToken, booking.reservationId);
    }
  });
});

function expectFailure(
  result: { status: number; body: unknown },
  status: number,
  message: string,
  code?: string,
): void {
  expect(result.status, JSON.stringify(result.body)).toBe(status);
  expect(errorText(result.body)).toContain(message);
  if (code) expect(errorCode(result.body)).toBe(code);
}
