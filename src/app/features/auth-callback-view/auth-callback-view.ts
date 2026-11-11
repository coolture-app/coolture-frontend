import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-auth-callback-view',
  template: '',
})
export class AuthCallbackView implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    try {
      const returnUrl = await this.authService.completeLogin(
        params.get('code'),
        params.get('state'),
      );
      await firstValueFrom(this.authService.checkSession());
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      console.error('Login failed', error);
      await this.router.navigateByUrl('/');
    }
  }
}
