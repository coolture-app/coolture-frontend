import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCamera, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { InitialsPipe } from '../../../core/pipes/initials.pipe';
import { UserProfile } from '../../../core/models/users/user-profile.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Users } from '../../../core/services/users/users.service';
import { MediaService } from '../../../core/services/media/media.service';
import { ConfirmService } from '../../../core/services/confirm/confirm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { PhotoViewerService } from '../../../core/services/photo-viewer/photo-viewer.service';
import { AvatarCropper } from '../../../core/components/avatar-cropper/avatar-cropper';
import { Menu, MenuItem } from '../../../core/components/menu/menu';
import { Tooltip } from '../../../core/directives/tooltip';

/** A profile's photo, enlarged on a tap. On your own, a badge adds, changes or removes it. */
@Component({
  selector: 'app-profile-avatar',
  imports: [InitialsPipe, TranslatePipe, NgIcon, AvatarCropper, Menu, MenuItem, Tooltip],
  viewProviders: [provideIcons({ lucideCamera, lucidePlus, lucideTrash2 })],
  templateUrl: './profile-avatar.html',
  styleUrl: './profile-avatar.scss',
})
export class ProfileAvatar {
  readonly user = input.required<UserProfile>();
  readonly own = input(false);
  /** The profile saved with the new photo, or without one. */
  readonly changed = output<UserProfile>();

  private authService = inject(AuthService);
  private usersService = inject(Users);
  private mediaService = inject(MediaService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private photoViewer = inject(PhotoViewerService);

  readonly uploading = signal(false);
  /** A photo picked and being placed in the circle, not uploaded yet. */
  readonly pickedFile = signal<File | null>(null);

  show(): void {
    const avatar = this.user().avatar;
    if (avatar?.url) {
      this.photoViewer.show([{ url: avatar.url, width: avatar.width, height: avatar.height }], 0);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.pickedFile.set(file);
    }
  }

  async upload(cropped: Blob): Promise<void> {
    this.pickedFile.set(null);
    const userId = this.user().id;
    this.uploading.set(true);
    try {
      const file = new File([cropped], 'avatar.jpg', { type: cropped.type });
      const media = await this.mediaService.upload(file, 'PROFILE_IMAGE');
      await firstValueFrom(this.usersService.setOrUpdateProfilePicture(userId, media.id, media.id));
      await this.reload(userId);
    } catch (err) {
      console.error('Error uploading avatar', err);
      this.toast.failed();
    } finally {
      this.uploading.set(false);
    }
  }

  async remove(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'PROFILE.removeAvatarTitle',
      confirm: 'PROFILE.removeAvatar',
      danger: true,
    });
    if (!confirmed) return;

    const userId = this.user().id;
    try {
      await firstValueFrom(this.usersService.deleteProfileImage(userId));
      await this.reload(userId);
    } catch (err) {
      console.error('Error removing avatar', err);
      this.toast.failed();
    }
  }

  private async reload(userId: string): Promise<void> {
    const updated = await firstValueFrom(this.usersService.getUserById(userId));
    if (updated) {
      this.authService.markProfile(updated);
      this.changed.emit(updated);
    }
  }
}
