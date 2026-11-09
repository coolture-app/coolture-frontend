import type { DevTools } from '../app/core/auth/dev-identity';

export const environment = {
  production: true,
  apiUrlServer: 'http://localhost:8090/api',
  apiUrlBrowser: 'http://10.0.0.1:8090/api',
  cognito: {
    domain: '',
    clientId: '',
  },
  // Development builds only, so production bundles have none of src/app/dev.
  devTools: null as DevTools | null,
};
