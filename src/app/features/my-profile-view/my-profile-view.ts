import { InitialsPipe } from '../../core/pipes/initials.pipe';
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
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { InterestGroup, ProfileInterests } from './profile-interests/profile-interests';
import {
  lucideCamera,
  lucideEllipsis,
  lucideHeart,
  lucideMapPin,
  lucidePencil,
  lucidePlus,
  lucideSettings,
} from '@ng-icons/lucide';

import { AuthService } from '../../core/services/auth/auth.service';
import { Users } from '../../core/services/users/users.service';
import { RelationsService, unblockQuestion } from '../../core/services/relations/relations.service';
import { ConfirmService } from '../../core/services/confirm/confirm.service';
import { MediaService } from '../../core/services/media/media.service';
import { InterestsService } from '../../core/services/interests/interests.service';
import { KindsService } from '../../core/services/interests/kinds.service';
import { kindIcon } from '../../core/icons/kind-icons';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { Interest, label } from '../../core/models/interests/interest.model';
import { FollowListComponent, FollowListType } from '../../core/components/follow-list/follow-list';
import { Sheet } from '../../core/components/sheet/sheet';
import { BackLink } from '../../core/components/back-link/back-link';
import { Btn } from '../../core/components/btn/btn';
import { FollowBtn } from '../../core/components/follow-btn/follow-btn';
import { RelationPill } from '../../core/components/relation-pill/relation-pill';
import { Tooltip } from '../../core/directives/tooltip';
import { ToastService } from '../../core/services/toast/toast.service';
import { HomeArea } from '../home-area/home-area';
import { PhotoViewerService } from '../../core/services/photo-viewer/photo-viewer.service';
import { AvatarCropper } from '../../core/components/avatar-cropper/avatar-cropper';
import { NotFoundView } from '../not-found-view/not-found-view';
import { LoadState } from '../../core/components/load-state/load-state';
import { ProfileEvents } from './profile-events/profile-events';

/** Your own profile at `/profile`, and anyone's at `/users/:username`. */
@Component({
  selector: 'app-user-profile-view',
  imports: [
    ProfileInterests,
    InitialsPipe,
    TranslatePipe,
    NgIcon,
    AvatarCropper,
    FollowListComponent,
    Sheet,
    RouterLink,
    BackLink,
    Btn,
    FollowBtn,
    RelationPill,
    Tooltip,
    HomeArea,
    NotFoundView,
    LoadState,
    ProfileEvents,
  ],
  viewProviders: [
    provideIcons({
      lucideCamera,
      lucideEllipsis,
      lucideHeart,
      lucideMapPin,
      lucidePencil,
      lucidePlus,
      lucideSettings,
    }),
  ],
  templateUrl: './my-profile-view.html',
  styleUrl: './my-profile-view.scss',
})
export class UserProfileView {
  private authService = inject(AuthService);
  private photoViewer = inject(PhotoViewerService);
  private usersService = inject(Users);
  private relationsService = inject(RelationsService);
  private mediaService = inject(MediaService);
  private interestsService = inject(InterestsService);
  private kindsService = inject(KindsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private injector = inject(Injector);
  private bioInput = viewChild<ElementRef<HTMLTextAreaElement>>('bioInput');

  private lang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });

  user = signal<UserProfile | null>(null);
  isOwnProfile = signal(true);
  /** Someone missing, or who blocked you. The URL stays, as for any page that isn't there. */
  notFound = signal(false);
  readonly failed = signal(false);
  /** The profile asked for, null for your own; for Spróbuj ponownie. */
  private username: string | null = null;
  /** Someone you blocked: only who they are, and Odblokuj. */
  readonly blocked = computed(() => !this.isOwnProfile() && !!this.user()?.isBlocked);
  followersCount = signal(0);
  followingCount = signal(0);
  isUploadingAvatar = signal(false);

  editingBio = signal(false);
  savingBio = signal(false);
  bioDraft = signal('');

  menuOpen = signal(false);
  avatarMenuOpen = signal(false);
  /** A photo picked and being placed in the circle, not uploaded yet. */
  pickedFile = signal<File | null>(null);
  private avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');
  readonly followList = signal<FollowListType | null>(null);
  private followSheet = viewChild(Sheet);
  private router = inject(Router);
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
  private readonly interests = computed(() => {
    const picked = new Set(this.user()?.interests ?? []);
    return this.interestCatalog()
      .filter((interest) => picked.has(interest.key))
      .map((interest) => ({
        key: interest.key,
        label: label(interest, this.lang()),
      }));
  });
  /** Before the interests, also in the catalogue's order. */
  private readonly kinds = computed(() => {
    const picked = new Set(this.user()?.kinds ?? []);
    return this.kindsService
      .kinds()
      .filter((kind) => picked.has(kind.key))
      .map((kind) => ({
        key: kind.key,
        label: this.kindsService.name(kind.key),
        icon: kindIcon(kind.key),
      }));
  });
  /**
   * Your own profile lists its chips as they are. Someone else's has a box of the ones you share, when there are any,
   * and a box of the rest, each with its title.
   */
  readonly chipGroups = computed((): InterestGroup[] => {
    const kinds = this.kinds();
    const interests = this.interests();
    const me = this.authService.currentUser();
    const mine = new Set([...(me?.kinds ?? []), ...(me?.interests ?? [])]);
    const group = (shared: boolean, title: string): InterestGroup => ({
      title,
      shared,
      kinds: kinds.filter((chip) => mine.has(chip.key) === shared),
      interests: interests.filter((chip) => mine.has(chip.key) === shared),
    });
    const groups = this.isOwnProfile()
      ? [{ title: null, shared: true, kinds, interests }]
      : [group(true, 'PROFILE.sharedInterests'), group(false, 'PROFILE.interests')];
    return groups.filter((g) => g.kinds.length || g.interests.length);
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
    this.followList.set(null);
    this.menuOpen.set(false);
    this.avatarMenuOpen.set(false);
    this.editingBio.set(false);
    this.notFound.set(false);
    this.failed.set(false);
    this.username = username;

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
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.notFound.set(true);
      } else {
        console.error('Error loading user profile', err);
        this.failed.set(true);
      }
    }
  }

  retry(): void {
    void this.load(this.username);
  }

  private showUser(user: UserProfile, own: boolean) {
    this.user.set(user);
    this.isOwnProfile.set(own);
    this.followersCount.set(user.followersCount ?? 0);
    this.followingCount.set(user.followingCount ?? 0);
  }

  followListUrl(list: FollowListType): string {
    return `${this.router.url.split('#')[0]}#${list}`;
  }

  onFollowChanged(by: number) {
    this.followingCount.update((c) => c + by);
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
      this.toast.failed();
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
        this.user.set({ ...u, isFollowing: false, followersCount: (u.followersCount ?? 0) - 1 });
        this.followersCount.update((c) => c - 1);
      } else {
        await firstValueFrom(this.relationsService.follow(u.id));
        this.user.set({ ...u, isFollowing: true, followersCount: (u.followersCount ?? 0) + 1 });
        this.followersCount.update((c) => c + 1);
      }
    } catch (err) {
      console.error('Error toggling follow', err);
      this.toast.failed();
    }
  }

  toggleMenu() {
    this.toggle(this.menuOpen);
  }

  showAvatar() {
    const avatar = this.user()?.avatar;
    if (avatar?.url) {
      this.photoViewer.show([{ url: avatar.url, width: avatar.width, height: avatar.height }], 0);
    }
  }

  /** Without a photo there's nothing to choose between, so the file picker opens at once. */
  onAvatarTap() {
    if (this.user()?.avatar) {
      this.toggle(this.avatarMenuOpen);
    } else {
      this.avatarInput()?.nativeElement.click();
    }
  }

  closeAvatarMenu(event: Event) {
    event.stopPropagation();
    this.avatarMenuOpen.set(false);
  }

  /** The next click anywhere closes the menu, including on one of its items. */
  private toggle(open: WritableSignal<boolean>) {
    const opening = !open();
    open.set(opening);
    if (opening) {
      // After this click has finished, so that it doesn't count as the next one.
      setTimeout(() =>
        this.document.addEventListener('click', () => open.set(false), { once: true }),
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
    const confirmed = await this.confirm.ask(
      isCurrentlyBlocked
        ? unblockQuestion(u.username)
        : {
            title: 'PROFILE.blockTitle',
            text: 'PROFILE.blockText',
            confirm: 'PROFILE.block',
            params: { username: u.username },
            danger: true,
          },
    );
    if (!confirmed) return;

    try {
      if (isCurrentlyBlocked) {
        await firstValueFrom(this.relationsService.unblock(u.id));
        // The slim profile has none of the rest. If they block you too, this ends in the not-found view.
        await this.loadOtherUserProfile(u.username);
      } else {
        await firstValueFrom(this.relationsService.block(u.id));
        // The slim profile the API gives now. A block ends follows both ways.
        const { id, username, firstName, lastName, avatar } = u;
        this.user.set({
          id,
          username,
          firstName,
          lastName,
          avatar,
          isBlocked: true,
          isFollowing: false,
          followsYou: false,
        });
        this.followSheet()?.close();
      }
    } catch (err) {
      console.error('Error blocking user', err);
      this.toast.failed();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.pickedFile.set(file);
    }
  }

  async uploadAvatar(cropped: Blob) {
    this.pickedFile.set(null);
    const userId = this.user()?.id;
    if (!userId || !this.isOwnProfile()) return;
    const file = new File([cropped], 'avatar.jpg', { type: cropped.type });

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
      this.toast.failed();
    } finally {
      this.isUploadingAvatar.set(false);
    }
  }

  async onRemoveAvatar() {
    const userId = this.user()?.id;
    if (!userId || !this.isOwnProfile()) return;

    const confirmed = await this.confirm.ask({
      title: 'PROFILE.removeAvatarTitle',
      confirm: 'PROFILE.removeAvatar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await firstValueFrom(this.usersService.deleteProfileImage(userId));
      const updatedUser = await firstValueFrom(this.usersService.getUserById(userId));
      if (updatedUser) {
        this.authService.currentUser.set(updatedUser);
        this.user.set(updatedUser);
      }
    } catch (err) {
      console.error('Error removing avatar', err);
      this.toast.failed();
    }
  }
}
