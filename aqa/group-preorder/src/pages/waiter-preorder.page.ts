import { expect, type Page } from '@playwright/test';

export class WaiterPreOrderPage {
  constructor(private readonly page: Page) {}

  async open(reservationId: string, tableNumber: number): Promise<void> {
    await this.page.goto('/main');
    await this.page.evaluate(
      (data) => sessionStorage.setItem('waiterPreOrderData', JSON.stringify(data)),
      {
        reservationId,
        createdByName: 'Owner',
        createdByRole: 'Customer',
        tableName: String(tableNumber),
      },
    );
    await this.page.goto('/waiter-pre-order');
    await expect(this.page.getByRole('heading', { name: /Pre-order of/ })).toBeVisible();
  }

  async expectDish(name: string, quantity: number): Promise<void> {
    const card = this.page.locator('.pre-order-dish', { hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText(`Quantity: ${quantity}`);
  }
}
