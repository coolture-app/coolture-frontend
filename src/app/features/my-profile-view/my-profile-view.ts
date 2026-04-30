import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroCamera,
  heroPencil,
  heroCheck,
  heroXMark,
  heroUserPlus,
  heroUserMinus,
  heroNoSymbol,
  heroArrowDownOnSquare,
  heroArrowUpOnSquare,
  heroArrowLeft,
} from '@ng-icons/heroicons/outline';

import { AuthService } from '../../core/services/auth/auth.service';
import { Users } from '../../core/services/users/users.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { MediaService } from '../../core/services/media/media.service';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { UserSummary } from '../../core/models/users/user-summary.model';
import { UserProfileUpdateRequest } from '../../core/models/users/user-profile-update-request.model';
import { FollowListComponent } from '../../core/components/follow-list/follow-list';
import { Btn } from '../../core/components/btn/btn';
import { DateFormatService } from '../../core/services/date-format/date-format.service';

@Component({
  selector: 'app-user-profile-view',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    NgIcon,
    FollowListComponent,
    RouterModule,
    Btn,
  ],
  viewProviders: [
    provideIcons({
      heroCamera,
      heroPencil,
      heroCheck,
      heroXMark,
      heroUserPlus,
      heroUserMinus,
      heroNoSymbol,
      heroArrowDownOnSquare,
      heroArrowUpOnSquare,
      heroArrowLeft,
    }),
  ],
  templateUrl: './my-profile-view.html',
  styleUrl: './my-profile-view.scss',
})
export class UserProfileView implements OnInit {
  private authService = inject(AuthService);
  private usersService = inject(Users);
  private relationsService = inject(RelationsService);
  private mediaService = inject(MediaService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private dateFormatService = inject(DateFormatService);

  user = signal<UserProfile | null>(null);
  readonly dateFormats = this.dateFormatService.formats;
  isOwnProfile = signal(true);
  followersCount = signal(0);
  followingCount = signal(0);
  isEditing = signal(false);
  isUploadingAvatar = signal(false);

  editForm = this.fb.group({
    bio: [''],
  });

  showFollowers = signal(false);
  showFollowing = signal(false);
  showBlocked = signal(false);
  blockedUsers = signal<UserSummary[]>([]);

  async ngOnInit() {
    const username = this.route.snapshot.paramMap.get('username');
    const currentUser = this.authService.currentUser();

    if (username && currentUser && username !== currentUser.username) {
      await this.loadOtherUserProfile(username);
    } else {
      this.authService.checkSession().subscribe();
      if (currentUser) {
        this.user.set(currentUser);
        this.isOwnProfile.set(true);
        this.initForm();
        this.updateCounts();
      }
    }
  }

  private async loadOtherUserProfile(username: string) {
    try {
      const userProfile = await firstValueFrom(this.usersService.getUserByUsername(username));
      this.user.set(userProfile);
      this.isOwnProfile.set(false);
      this.followersCount.set(userProfile.followersCount);
      this.followingCount.set(userProfile.followingCount);
    } catch (err) {
      console.error('Error loading user profile', err);
    }
  }

  private updateCounts() {
    const u = this.user();
    if (u) {
      this.followersCount.set(u.followersCount);
      this.followingCount.set(u.followingCount);
    }
  }

  onFollowChanged(event: { deltaFollowers: number; deltaFollowing: number }) {
    this.followersCount.update((c) => c + event.deltaFollowers);
    this.followingCount.update((c) => c + event.deltaFollowing);
  }

  private initForm() {
    const u = this.user();
    if (!u) return;
    this.editForm.patchValue({
      bio: u.bio ?? '',
    });
  }

  toggleEdit() {
    const editing = this.isEditing();
    if (!editing) {
      this.initForm();
    }
    this.isEditing.set(!editing);
  }

  async onSave() {
    const userValue = this.user();
    if (!userValue || !this.isOwnProfile()) return;

    const { bio } = this.editForm.getRawValue();
    const payload: UserProfileUpdateRequest = {
      bio: bio || null,
    };

    try {
      const updated = await firstValueFrom(this.usersService.updateProfile(userValue.id, payload));
      if (updated) {
        this.authService.currentUser.set(updated);
        this.user.set(updated);
        this.isEditing.set(false);
        this.editForm.patchValue({ bio: updated.bio ?? '' });
      }
    } catch (err) {
      console.error('Error updating profile', err);
      alert('Error updating profile');
    }
  }

  async toggleFollow() {
    const u = this.user();
    if (!u || this.isOwnProfile()) return;

    try {
      if (u.isFollowing) {
        await firstValueFrom(this.relationsService.unfollow(u.id));
        this.user.set({ ...u, isFollowing: false, followersCount: u.followersCount - 1 });
        this.followersCount.update((c) => c - 1);
      } else {
        await firstValueFrom(this.relationsService.follow(u.id));
        this.user.set({ ...u, isFollowing: true, followersCount: u.followersCount + 1 });
        this.followersCount.update((c) => c + 1);
      }
    } catch (err) {
      console.error('Error toggling follow', err);
    }
  }

  async onBlock() {
    const u = this.user();
    if (!u || this.isOwnProfile()) return;

    const isCurrentlyBlocked = u.isBlocked;
    if (!confirm(isCurrentlyBlocked ? 'Unblock this user?' : 'Block this user?')) return;

    try {
      if (isCurrentlyBlocked) {
        await firstValueFrom(this.relationsService.unblock(u.id));
        this.user.set({ ...u, isBlocked: false });
      } else {
        await firstValueFrom(this.relationsService.block(u.id));
        this.user.set({ ...u, isBlocked: true });
      }
    } catch (err) {
      console.error('Error blocking user', err);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const userId = this.user()?.id;
    if (!userId || !this.isOwnProfile()) return;

    this.isUploadingAvatar.set(true);

    try {
      const initRes = await firstValueFrom(
        this.mediaService.initUpload({
          purpose: 'profile_image',
          mimeType: file.type,
          sizeBytes: file.size,
          fileName: file.name,
        }),
      );

      if (!initRes) throw new Error('Failed to init upload');

      await firstValueFrom(
        this.mediaService.uploadToS3(initRes.uploadUrl, file, initRes.requiredHeaders),
      );

      const mediaResource = await firstValueFrom(this.mediaService.completeUpload(initRes.mediaId));

      if (!mediaResource) throw new Error('Failed to complete upload');

      await firstValueFrom(
        this.usersService.setOrUpdateProfilePicture(userId, mediaResource.id, mediaResource.id),
      );

      const updatedUser = await firstValueFrom(this.usersService.getUserById(userId));
      if (updatedUser) {
        this.authService.currentUser.set(updatedUser);
        this.user.set(updatedUser);
      }
    } catch (err) {
      console.error('Error uploading avatar', err);
      alert('Error uploading avatar');
    } finally {
      this.isUploadingAvatar.set(false);
      input.value = '';
    }
  }

  async onRemoveAvatar() {
    const userId = this.user()?.id;
    if (!userId || !this.isOwnProfile()) return;

    if (!confirm('Remove profile picture?')) return;

    try {
      await firstValueFrom(this.usersService.deleteProfileImage(userId));
      const updatedUser = await firstValueFrom(this.usersService.getUserById(userId));
      if (updatedUser) {
        this.authService.currentUser.set(updatedUser);
        this.user.set(updatedUser);
      }
    } catch (err) {
      console.error('Error removing avatar', err);
      alert('Error removing avatar');
    }
  }

  toggleFollowers() {
    this.showFollowers.set(!this.showFollowers());
    this.showFollowing.set(false);
  }

  toggleFollowing() {
    this.showFollowing.set(!this.showFollowing());
    this.showFollowers.set(false);
  }

  async toggleBlocked() {
    if (this.showBlocked()) {
      this.showBlocked.set(false);
      return;
    }
    this.showBlocked.set(true);
    try {
      const currentUserId = this.authService.currentUser()?.id;
      if (!currentUserId) return;
      const res = await firstValueFrom(
        this.relationsService.getBlocking(currentUserId, { limit: 100, cursor: '' }),
      );
      this.blockedUsers.set(res.items);
    } catch (err) {
      console.error('Error loading blocked users', err);
    }
  }

  async onUnblock(userId: string) {
    if (!confirm('Unblock this user?')) return;
    try {
      await firstValueFrom(this.relationsService.unblock(userId));
      this.blockedUsers.update((list) => list.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Error unblocking user', err);
    }
  }
}
