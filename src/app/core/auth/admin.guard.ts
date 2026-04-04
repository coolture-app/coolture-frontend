import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { UserRole } from '../models/auth/role';

export const adminRoleGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getRole() == UserRole.Admin) {
    return true;
  }
  // TODO CHANGE ROUTE
  // GO TO 404
  router.navigate(['/login']);
  return false;
};
