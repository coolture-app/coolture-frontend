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

  protected choose(user: DevUser): void {
    this.identity.menuOpen.set(false);
    if (user !== this.identity.current) {
      this.identity.switchTo(user);
    }
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.identity.menuOpen.set(false);
  }

  // Pointerdown comes before the click, so a button that opens the menu, such as Zaloguj, isn't undone by it.
  @HostListener('document:pointerdown', ['$event'])
  protected closeOutside(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node | null)) {
      this.close();
    }
  }
}
