import { Component, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEllipsis, lucidePencil, lucideTrash2 } from '@ng-icons/lucide';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tooltip } from '../../directives/tooltip';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { PostService } from '../../services/post/post.service';
import { ToastService } from '../../services/toast/toast.service';

/** The owner's ⋯ on their post: Edytuj, and Usuń after a confirmation. */
@Component({
  selector: 'app-post-owner-menu',
  imports: [NgIcon, TranslatePipe, Tooltip],
  viewProviders: [provideIcons({ lucideEllipsis, lucidePencil, lucideTrash2 })],
  templateUrl: './post-owner-menu.html',
  styleUrl: './post-owner-menu.scss',
  host: {
    '(document:click)': 'closeOutside($event)',
    '(keydown.escape)': 'open.set(false)',
  },
})
export class PostOwnerMenu {
  readonly postId = input.required<string>();
  readonly postTitle = input.required<string>();
  readonly deleted = output<string>();

  private host = inject(ElementRef<HTMLElement>);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private posts = inject(PostService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly open = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((open) => !open);
  }

  closeOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  edit(): void {
    this.open.set(false);
    void this.router.navigate(['/posts', this.postId(), 'edit']);
  }

  async remove(): Promise<void> {
    this.open.set(false);
    const confirmed = await this.confirm.ask({
      title: 'POST.deleteTitle',
      text: 'POST.deleteText',
      confirm: 'POST.delete',
      params: { title: this.postTitle() },
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    const id = this.postId();
    this.posts
      .deletePost(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.deleted.emit(id),
        error: () => this.toast.show(this.translate.instant('POST.deleteFailed')),
      });
  }
}
