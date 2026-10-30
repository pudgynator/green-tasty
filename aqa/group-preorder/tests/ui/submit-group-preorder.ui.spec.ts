import { OrderStatus } from '../../src/api/client';
import { orderQuantity, prepareMergedCarts } from '../../src/api/setup';
import { env, requireEnv } from '../../src/config/env';
import { GroupOrderPage } from '../../src/pages/group-order.page';
import { LoginPage } from '../../src/pages/login.page';
import { WaiterPreOrderPage } from '../../src/pages/waiter-preorder.page';
import { expect, test } from '../fixtures';

test.describe('Consolidated pre-order confirmation', { tag: '@level2' }, () => {
  test('owner confirms the merged pre-order and unsubmitted carts stay out', async ({
    page,
    api,
    ownerToken,
  }, testInfo) => {
    const prepared = await prepareMergedCarts(api, ownerToken, testInfo.title, testInfo.parallelIndex);
    try {
      await new LoginPage(page).signIn(requireEnv('OWNER_EMAIL'), requireEnv('OWNER_PASSWORD'));
      const groupOrder = new GroupOrderPage(page);
      await groupOrder.open(prepared.booking.reservationId);

      const consolidated = groupOrder.consolidated();
      await expect(consolidated).toContainText(`${prepared.sharedDish.name} × ${prepared.sharedQuantity}`);
      await expect(consolidated).not.toContainText(prepared.excludedDish.name);
      await expect(page.getByText(/haven['’]t submitted their cart yet/)).toBeVisible();

      await groupOrder.confirm();

      const order = await api.getOrder(ownerToken, prepared.booking.reservationId);
      const status = order.status ?? order.Status;
      expect(status === OrderStatus.SubmittedByCustomer || status === 'SubmittedByCustomer').toBeTruthy();
      expect(orderQuantity(order, prepared.sharedDish.id)).toBe(prepared.sharedQuantity);
      expect(orderQuantity(order, prepared.excludedDish.id)).toBe(0);
    } finally {
      await api.cancelReservation(ownerToken, prepared.booking.reservationId);
    }
  });

  test('waiter sees the dishes the owner confirmed', async ({ page, api, ownerToken }, testInfo) => {
    test.skip(
      !env('WAITER_EMAIL') || !env('WAITER_PASSWORD'),
      'Set WAITER_EMAIL and WAITER_PASSWORD for a Cognito user in the Waiter group.',
    );

    const prepared = await prepareMergedCarts(api, ownerToken, testInfo.title, testInfo.parallelIndex);
    try {
      const confirmed = await api.submitGroup(
        ownerToken,
        prepared.booking.groupId,
        prepared.booking.reservationId,
      );
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);

      await new LoginPage(page).signIn(env('WAITER_EMAIL')!, env('WAITER_PASSWORD')!);
      const waiter = new WaiterPreOrderPage(page);
      await waiter.open(prepared.booking.reservationId, prepared.booking.tableNumber);
      await expect(page.locator('.pre-order-dish')).toHaveCount(1);
      await waiter.expectDish(prepared.sharedDish.name, prepared.sharedQuantity);
      await expect(page.locator('.pre-order-dish')).not.toContainText(prepared.excludedDish.name);
    } finally {
      await api.cancelReservation(ownerToken, prepared.booking.reservationId);
    }
  });
});
