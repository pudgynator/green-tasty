import { expect, type Page } from '@playwright/test';

export class GroupOrderPage {
  constructor(private readonly page: Page) {}

  async open(reservationId: string): Promise<void> {
    await this.page.goto(`/reservations/${reservationId}/group-order`);
    await expect(this.page.getByRole('heading', { name: 'Group Pre-Order' })).toBeVisible();
    await expect(this.page.getByRole('region', { name: 'Consolidated pre-order' })).toBeVisible();
  }

  consolidated() {
    return this.page.getByRole('region', { name: 'Consolidated pre-order' });
  }

  async confirm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit Pre-Order' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Submit Pre-Order' });
    await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(this.page.getByText('Sent to Restaurant')).toBeVisible();
    await expect(this.page.getByText('Pre-order sent to the restaurant')).toBeVisible();
  }
}
