import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Btn } from '../../core/components/btn/btn';

@Component({
  selector: 'app-not-found-view',
  imports: [TranslatePipe, Btn],
  templateUrl: './not-found-view.html',
  styleUrl: './not-found-view.scss',
})
export class NotFoundView {
  private router = inject(Router);
  goBackToMainPage() {
    this.router.navigate(['/']);
  }
}
