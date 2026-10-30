import { test as base } from '@playwright/test';
import { ApiClient } from '../src/api/client';
import { requireEnv } from '../src/config/env';

interface WorkerFixtures {
  api: ApiClient;
  ownerToken: string;
}

export const test = base.extend<{}, WorkerFixtures>({
  api: [
    async ({}, use) => {
      await use(new ApiClient());
    },
    { scope: 'worker' },
  ],
  ownerToken: [
    async ({ api }, use) => {
      const token = await api.signIn(requireEnv('OWNER_EMAIL'), requireEnv('OWNER_PASSWORD'));
      await use(token);
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
