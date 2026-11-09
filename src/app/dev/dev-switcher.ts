import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { DevIdentityService } from './dev-identity.service';
import { DevUser } from './dev-users';

/** The development build's pill in the corner: who the app acts as, and a menu to change it. */
@Component({
  selector: 'app-dev-switcher',
  templateUrl: './dev-switcher.html',
  styleUrl: './dev-switcher.scss',
})
export class DevSwitcher {
  protected identity = inject(DevIdentityService);
  private host = inject(ElementRef<HTMLElement>);

  protected toggle(): void {
    this.identity.menuOpen.update((open) => !open);
  }

  protected choose(user: DevUser | null): void {
    this.identity.menuOpen.set(false);
    if (user?.id !== this.identity.current()?.id) {
      this.identity.switchTo(user);
    }
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.identity.menuOpen.set(false);
  }

  // The navbar's login button opens the menu too, so a click there must not close it straight away.
  @HostListener('document:click', ['$event'])
  protected closeOutside(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!this.host.nativeElement.contains(target) && !target?.closest('.navbar__actions')) {
      this.close();
    }
  }
}
