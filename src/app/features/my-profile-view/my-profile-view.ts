import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCamera,
  lucideEllipsis,
  lucideHeart,
  lucideMapPin,
  lucidePencil,
  lucideSettings,
  lucideX,
} from '@ng-icons/lucide';

import { AuthService } from '../../core/services/auth/auth.service';
import { Users } from '../../core/services/users/users.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { MediaService } from '../../core/services/media/media.service';
import { InterestsService } from '../../core/services/interests/interests.service';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { Interest } from '../../core/models/interests/interest.model';
import { FollowListComponent } from '../../core/components/follow-list/follow-list';
import { Btn } from '../../core/components/btn/btn';
import { FollowBtn } from '../../core/components/follow-btn/follow-btn';
import { Tooltip } from '../../core/directives/tooltip';
import { ToastService } from '../../core/services/toast/toast.service';
import { HomeArea } from '../home-area/home-area';

/** Your own profile at `/profile`, and anyone's at `/users/:username`. */
@Component({
  selector: 'app-user-profile-view',
  imports: [
    TranslatePipe,
    NgIcon,
    FollowListComponent,
    RouterLink,
    Btn,
    FollowBtn,
    Tooltip,
    HomeArea,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideCamera,
      lucideEllipsis,
      lucideHeart,
      lucideMapPin,
      lucidePencil,
      lucideSettings,
      lucideX,
    }),
  ],
  templateUrl: './my-profile-view.html',
  styleUrl: './my-profile-view.scss',
})
export class UserProfileView {
  private authService = inject(AuthService);
  private usersService = inject(Users);
  private relationsService = inject(RelationsService);
  private mediaService = inject(MediaService);
  private interestsService = inject(InterestsService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private injector = inject(Injector);
  private bioInput = viewChild<ElementRef<HTMLTextAreaElement>>('bioInput');

  private lang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });

  user = signal<UserProfile | null>(null);
  isOwnProfile = signal(true);
  followersCount = signal(0);
  followingCount = signal(0);
  isUploadingAvatar = signal(false);

  editingBio = signal(false);
  savingBio = signal(false);
  bioDraft = signal('');

  menuOpen = signal(false);
  showFollowers = signal(false);
  showFollowing = signal(false);
  showHome = signal(false);
  /** Private, so only shown on your own profile, from `/auth/me`. */
  readonly home = this.authService.home;

  /** Empty if the catalogue fails: the chips are optional. */
  private interestCatalog = toSignal(
    this.interestsService.getCatalog().pipe(
      map((catalog) => catalog.categories.flatMap((category) => category.interests)),
      catchError(() => of([] as Interest[])),
    ),
    { initialValue: [] as Interest[] },
  );
  /** In the catalogue's order, so every profile lists them the same way. */
  readonly interests = computed(() => {
    const picked = new Set(this.user()?.interests ?? []);
    const en = this.lang() === 'en';
    return this.interestCatalog()
      .filter((interest) => picked.has(interest.key))
      .map((interest) => ({ key: interest.key, label: en ? interest.labelEn : interest.labelPl }));
  });

  /** Month and year only. The parts of a full date, because Polish needs the month's genitive. */
  readonly since = computed(() => {
    const createdAt = this.user()?.createdAt;
    if (!createdAt) return '';
    const parts = new Intl.DateTimeFormat(this.lang() || 'pl', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(new Date(createdAt));
    return parts
      .filter((part) => part.type === 'month' || part.type === 'year')
      .map((part) => part.value)
      .join(' ');
  });

  constructor() {
    // The component stays when a follow list leads to another user's profile.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => void this.load(params.get('username')));
  }

  private async load(username: string | null) {
    this.showFollowers.set(false);
    this.showFollowing.set(false);
    this.menuOpen.set(false);
    this.editingBio.set(false);

    const currentUser = this.authService.currentUser();
    if (username && currentUser && username !== currentUser.username) {
      await this.loadOtherUserProfile(username);
    } else {
      if (currentUser) {
        this.showUser(currentUser, true);
      }
      // Fresh counts and interests, changed elsewhere since the session started.
      this.authService.checkSession().subscribe(() => {
        const fresh = this.authService.currentUser();
        if (fresh && this.isOwnProfile()) {
          this.showUser(fresh, true);
        }
      });
    }
  }

  private async loadOtherUserProfile(username: string) {
    this.user.set(null);
    this.isOwnProfile.set(false);
    try {
      const userProfile = await firstValueFrom(this.usersService.getUserByUsername(username));
      this.showUser(userProfile, false);
    } catch (err) {
      console.error('Error loading user profile', err);
    }
  }

  private showUser(user: UserProfile, own: boolean) {
    this.user.set(user);
    this.isOwnProfile.set(own);
    this.followersCount.set(user.followersCount);
    this.followingCount.set(user.followingCount);
  }

  onFollowChanged(event: { deltaFollowers: number; deltaFollowing: number }) {
    this.followersCount.update((c) => c + event.deltaFollowers);
    this.followingCount.update((c) => c + event.deltaFollowing);
  }

  startEditingBio() {
    this.bioDraft.set(this.user()?.bio ?? '');
    this.editingBio.set(true);
    afterNextRender(
      () => {
        const textarea = this.bioInput()?.nativeElement;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
      },
      { injector: this.injector },
    );
  }

  cancelEditingBio() {
    this.editingBio.set(false);
  }

  async saveBio() {
    const userValue = this.user();
    if (!userValue || !this.isOwnProfile() || this.savingBio()) return;

    this.savingBio.set(true);
    try {
      const updated = await firstValueFrom(
        this.usersService.updateProfile(userValue.id, { bio: this.bioDraft().trim() || null }),
      );
      if (updated) {
        this.authService.currentUser.set(updated);
        this.user.set(updated);
        this.editingBio.set(false);
      }
    } catch (err) {
      console.error('Error updating profile', err);
      this.toast.show(this.translate.instant('PROFILE.saveFailed'));
    } finally {
      this.savingBio.set(false);
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

  /** The next click anywhere closes the menu, including on one of its items. */
  toggleMenu() {
    const opening = !this.menuOpen();
    this.menuOpen.set(opening);
    if (opening) {
      // After this click has finished, so that it doesn't count as the next one.
      setTimeout(() =>
        this.document.addEventListener('click', () => this.menuOpen.set(false), { once: true }),
      );
    }
  }

  closeMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen.set(false);
  }

  async onBlock() {
    const u = this.user();
    if (!u || this.isOwnProfile()) return;

    const isCurrentlyBlocked = u.isBlocked;
    const question = isCurrentlyBlocked ? 'PROFILE.unblockConfirm' : 'PROFILE.blockConfirm';
    if (!confirm(this.translate.instant(question))) return;

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
          purpose: 'PROFILE_IMAGE',
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
      this.toast.show(this.translate.instant('PROFILE.saveFailed'));
    } finally {
      this.isUploadingAvatar.set(false);
      input.value = '';
    }
  }

  async onRemoveAvatar() {
    const userId = this.user()?.id;
    if (!userId || !this.isOwnProfile()) return;

    if (!confirm(this.translate.instant('PROFILE.removeAvatarConfirm'))) return;

    try {
      await firstValueFrom(this.usersService.deleteProfileImage(userId));
      const updatedUser = await firstValueFrom(this.usersService.getUserById(userId));
      if (updatedUser) {
        this.authService.currentUser.set(updatedUser);
        this.user.set(updatedUser);
      }
    } catch (err) {
      console.error('Error removing avatar', err);
      this.toast.show(this.translate.instant('PROFILE.saveFailed'));
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
}
