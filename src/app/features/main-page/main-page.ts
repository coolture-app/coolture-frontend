import { Component } from '@angular/core';
import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';

@Component({
  selector: 'app-main-page',
  imports: [TranslatePipe, TranslateDirective],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
})
export class MainPage {}
