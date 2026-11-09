import { DEV_IDENTITY, DevTools } from '../core/auth/dev-identity';
import { DevIdentityService } from './dev-identity.service';
import { DevSwitcher } from './dev-switcher';

/**
 * The development build's tools for the local stack. Only `src/environments/dev-tools.development.ts`
 * imports this folder, and it replaces `dev-tools.ts` in development builds only, so a production bundle has none of it.
 */
export const devTools: DevTools = {
  providers: [DevIdentityService, { provide: DEV_IDENTITY, useExisting: DevIdentityService }],
  component: DevSwitcher,
};
