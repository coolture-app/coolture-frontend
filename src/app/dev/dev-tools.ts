import { DEV_IDENTITY, DevTools } from '../core/auth/dev-identity';
import { devIdentityInterceptor } from './dev-identity.interceptor';
import { DevIdentityService } from './dev-identity.service';
import { DevSwitcher } from './dev-switcher';

/**
 * The development build's tools for the local stack. Only `environment.development.ts` imports this
 * folder, so a production bundle has none of it.
 */
export const devTools: DevTools = {
  providers: [DevIdentityService, { provide: DEV_IDENTITY, useExisting: DevIdentityService }],
  interceptor: devIdentityInterceptor,
  component: DevSwitcher,
};
