import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async signIn(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    const form = this.page.locator('form', { hasText: 'Sign In to Your Account' });
    await expect(form).toBeVisible();
    await form.getByPlaceholder('e.g. username@domain.com').fill(email);
    await form.getByRole('textbox', { name: /Password/ }).fill(password);
    await form.getByRole('button', { name: 'Sign In' }).click();
    await this.page.waitForURL(/\/(main|waiter-reservations)(\/|$|\?)/);
  }
}
