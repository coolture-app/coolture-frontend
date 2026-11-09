import type { DevTools } from '../app/core/auth/dev-identity';
import { devTools } from '../app/dev/dev-tools';

export const environment = {
  production: false,
  apiUrlServer: 'http://localhost:3000',
  apiUrlBrowser: 'http://localhost:3000',
  cognito: {
    domain: '',
    clientId: '',
  },
  // Acting as a seed user or a guest on the local stack, from the DEV pill.
  devTools: devTools as DevTools | null,
};
