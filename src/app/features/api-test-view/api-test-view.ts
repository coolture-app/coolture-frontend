import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
import { MediaService } from '../../core/services/media/media.service';
import { Users } from '../../core/services/users/users.service';
import { DictionaryService } from '../../core/services/dictionary/dictionary.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { Btn } from '../../core/components/btn/btn';
import { HttpErrorResponse } from '@angular/common/http';

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'running' | 'skipped';
  detail: string;
  duration?: number;
}

@Component({
  selector: 'app-api-test-view',
  imports: [CommonModule, Btn],
  templateUrl: './api-test-view.html',
  styleUrl: './api-test-view.scss',
})
export class ApiTestView {
  //TODO TEST OTHER SERVICES WHEN BACKEND IMPLEMENTED
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private usersService = inject(Users);
  private dictionaryService = inject(DictionaryService);
  private relationsService = inject(RelationsService);

  results = signal<TestResult[]>([]);
  running = signal(false);
  summary = signal({ total: 0, passed: 0, failed: 0, skipped: 0 });

  private addResult(r: TestResult) {
    this.results.update((prev) => [...prev, r]);
  }

  private updateLast(patch: Partial<TestResult>) {
    this.results.update((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
      return copy;
    });
  }

  private async runTest(name: string, fn: () => Promise<string>): Promise<void> {
    this.addResult({ name, status: 'running', detail: 'Running…' });
    const t0 = performance.now();
    try {
      const detail = await fn();
      this.updateLast({
        status: 'pass',
        detail,
        duration: Math.round(performance.now() - t0),
      });
    } catch (error: unknown) {
      const err = error as HttpErrorResponse;
      const msg = err?.error?.detail ?? err?.message ?? JSON.stringify(err);
      this.updateLast({
        status: 'fail',
        detail: `${err?.status ?? '?'} — ${msg}`,
        duration: Math.round(performance.now() - t0),
      });
    }
  }

  private addSectionHeader(name: string) {
    this.addResult({ name, status: 'skipped', detail: '── section ──' });
  }

  async runAllTests() {
    this.results.set([]);
    this.running.set(true);

    await this.runPostTests();
    await this.runMediaTests();
    await this.runUserTests();
    await this.runDictionaryTests();
    await this.runRelationTests();

    const all = this.results();
    this.summary.set({
      total: all.length,
      passed: all.filter((r) => r.status === 'pass').length,
      failed: all.filter((r) => r.status === 'fail').length,
      skipped: all.filter((r) => r.status === 'skipped').length,
    });
    this.running.set(false);
  }

  // ===================== POST SERVICE =====================

  private async runPostTests() {
    let createdPostId: string | null = null;

    await this.runTest('PostService.getPosts() — empty filters', async () => {
      const res = await lastValueFrom(this.postService.getPosts({ limit: 5 }));
      return `OK — got ${res.items.length} items, hasMore=${res.page.hasMore}`;
    });

    await this.runTest('PostService.getPosts() — with search q="test"', async () => {
      const res = await lastValueFrom(this.postService.getPosts({ limit: 5, q: 'test' }));
      return `OK — got ${res.items.length} items for q="test"`;
    });

    await this.runTest('PostService.addPost() — create new post', async () => {
      const res = await lastValueFrom(
        this.postService.addPost({
          title: 'API Test Post',
          categoryId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          type: 'ONLINE',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          description: 'Automated test post created by ApiTestView',
        }),
      );
      createdPostId = res.id;
      return `OK — created post id=${res.id}, title="${res.title}"`;
    });

    await this.runTest('PostService.getPost() — fetch created post', async () => {
      if (!createdPostId) return 'SKIPPED — no post was created';
      const res = await lastValueFrom(this.postService.getPost(createdPostId));
      return `OK — fetched post id=${res.id}, status=${res.status}`;
    });

    await this.runTest('PostService.updatePost() — patch title', async () => {
      if (!createdPostId) return 'SKIPPED — no post to update';
      const res = await lastValueFrom(
        this.postService.updatePost(createdPostId, {
          title: 'API Test Post UPDATED',
        }),
      );
      return `OK — updated title to "${res.title}", status=${res.status}`;
    });

    await this.runTest('PostService.deletePost() — soft delete', async () => {
      if (!createdPostId) return 'SKIPPED — no post to delete';
      await lastValueFrom(this.postService.deletePost(createdPostId));
      return `OK — soft-deleted post id=${createdPostId}`;
    });
  }

  // ===================== MEDIA SERVICE =====================

  private async runMediaTests() {
    let initMediaId: string | null = null;

    await this.runTest('MediaService.initUpload() — init upload', async () => {
      const res = await lastValueFrom(
        this.mediaService.initUpload({
          purpose: 'event_media',
          mimeType: 'image/png',
          sizeBytes: 1024,
          fileName: 'api-test-image.png',
        }),
      );
      initMediaId = res.mediaId;
      return `OK — mediaId=${res.mediaId}, uploadUrl length=${res.uploadUrl.length}, method=${res.httpMethod}`;
    });

    this.addResult({
      name: 'MediaService.uploadToS3() — skipped (no real file)',
      status: 'skipped',
      detail: 'Upload to S3 requires a real File object; skipping in automated test.',
    });

    await this.runTest('MediaService.completeUpload() — complete (expects 4xx)', async () => {
      if (!initMediaId) return 'SKIPPED — no media was initialized';
      try {
        const res = await lastValueFrom(this.mediaService.completeUpload(initMediaId));
        return `OK — completed media id=${res.id}, status=${res.status}`;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (err?.status >= 400 && err?.status < 500) {
          return `Expected client error ${err.status} (no real upload was done) — endpoint reachable`;
        }
        throw err;
      }
    });

    await this.runTest('MediaService.getMedia() — fetch media metadata', async () => {
      if (!initMediaId) return 'SKIPPED — no media was initialized';
      const res = await lastValueFrom(this.mediaService.getMedia(initMediaId));
      return `OK — media id=${res.id}, purpose=${res.purpose}, status=${res.status}`;
    });

    await this.runTest('MediaService.deleteMedia() — delete media', async () => {
      if (!initMediaId) return 'SKIPPED — no media was initialized';
      await lastValueFrom(this.mediaService.deleteMedia(initMediaId));
      return `OK — deleted media id=${initMediaId}`;
    });
  }

  // ===================== USER SERVICE =====================

  private async runUserTests() {
    let testUserId: string | null = null;

    await this.runTest('Users.searchForUsers() — search users', async () => {
      const res = await lastValueFrom(this.usersService.searchForUsers());
      return `OK — got ${res.items.length} users, hasMore=${res.page.hasMore}`;
    });

    await this.runTest('Users.searchForUsers(q="a") — search with query', async () => {
      const res = await lastValueFrom(this.usersService.searchForUsers('a'));
      return `OK — got ${res.items.length} users for q="a"`;
    });

    await this.runTest('Users.getUserById() — get user by ID', async () => {
      const searchRes = await lastValueFrom(this.usersService.searchForUsers());
      if (searchRes.items.length === 0) return 'SKIPPED — no users found';
      testUserId = searchRes.items[0].id;
      const res = await lastValueFrom(this.usersService.getUserById(testUserId));
      return `OK — user id=${res.id}, username="${res.username}", followers=${res.followersCount}`;
    });

    await this.runTest('Users.getUserByUsername() — get user by username', async () => {
      const searchRes = await lastValueFrom(this.usersService.searchForUsers());
      if (searchRes.items.length === 0) return 'SKIPPED — no users found';
      const username = searchRes.items[0].username;
      const res = await lastValueFrom(this.usersService.getUserByUsername(username));
      return `OK — user id=${res.id}, username="${res.username}"`;
    });

    this.addResult({
      name: 'Users.updateProfile() — skipped (avoid mutating real data)',
      status: 'skipped',
      detail: 'Skipped to avoid changing real user profile data.',
    });

    this.addResult({
      name: 'Users.setOrUpdateProfilePicture() — skipped (needs uploaded media)',
      status: 'skipped',
      detail: 'Requires two valid media IDs from a completed upload flow.',
    });

    this.addResult({
      name: 'Users.deleteProfileImage() — skipped (avoid mutating real data)',
      status: 'skipped',
      detail: 'Skipped to avoid deleting a real profile image.',
    });
  }

  // ===================== DICTIONARY SERVICE =====================

  private async runDictionaryTests() {
    await this.runTest('DictionaryService.getEventCategories()', async () => {
      const res = await lastValueFrom(this.dictionaryService.getEventCategories());
      return `OK — got ${res.length} categories: [${res.map((c) => c.name).join(', ')}]`;
    });

    await this.runTest('DictionaryService.getCountryCodes()', async () => {
      const res = await lastValueFrom(this.dictionaryService.getCountryCodes());
      return `OK — got ${res.length} country codes${res.length > 0 ? `, first: ${res[0].code}` : ''}`;
    });
  }

  // ===================== RELATIONS SERVICE =====================

  private async runRelationTests() {
    let testUserId: string | null = null;

    // Find a user to test relations against
    await this.runTest('Relations — resolve test user', async () => {
      const searchRes = await lastValueFrom(this.usersService.searchForUsers());
      if (searchRes.items.length === 0) return 'SKIPPED — no users found';
      testUserId = searchRes.items[0].id;
      return `OK — will use userId=${testUserId} (${searchRes.items[0].username})`;
    });

    await this.runTest('RelationsService.getFollowers()', async () => {
      if (!testUserId) return 'SKIPPED — no test user';
      const res = await lastValueFrom(this.relationsService.getFollowers(testUserId));
      return `OK — ${res.items.length} followers, hasMore=${res.page.hasMore}`;
    });

    await this.runTest('RelationsService.getFollowing()', async () => {
      if (!testUserId) return 'SKIPPED — no test user';
      const res = await lastValueFrom(this.relationsService.getFollowing(testUserId));
      return `OK — ${res.items.length} following, hasMore=${res.page.hasMore}`;
    });

    await this.runTest('RelationsService.getBlocking()', async () => {
      if (!testUserId) return 'SKIPPED — no test user';
      try {
        const res = await lastValueFrom(this.relationsService.getBlocking(testUserId));
        return `OK — ${res.items.length} blocked, hasMore=${res.page.hasMore}`;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        // 403 is expected if the test user is not the authenticated user
        if (err?.status === 403) {
          return `Expected 403 (can only view own block list) — endpoint reachable`;
        }
        throw err;
      }
    });

    // Find a DIFFERENT user to follow/unfollow
    let targetUserId: string | null = null;
    await this.runTest('Relations — resolve follow target', async () => {
      const searchRes = await lastValueFrom(this.usersService.searchForUsers());
      if (searchRes.items.length < 2) return 'SKIPPED — need at least 2 users';
      targetUserId = searchRes.items[1].id;
      return `OK — will follow/unfollow userId=${targetUserId} (${searchRes.items[1].username})`;
    });

    await this.runTest('RelationsService.follow()', async () => {
      if (!targetUserId) return 'SKIPPED — no target user';
      try {
        await lastValueFrom(this.relationsService.follow(targetUserId));
        return `OK — followed user ${targetUserId}`;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        // 409 = already following
        if (err?.status === 409) {
          return `409 Conflict (already following) — endpoint reachable`;
        }
        throw err;
      }
    });

    await this.runTest('RelationsService.unfollow()', async () => {
      if (!targetUserId) return 'SKIPPED — no target user';
      try {
        await lastValueFrom(this.relationsService.unfollow(targetUserId));
        return `OK — unfollowed user ${targetUserId}`;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        // 404 = not following
        if (err?.status === 404) {
          return `404 Not Found (was not following) — endpoint reachable`;
        }
        throw err;
      }
    });

    await this.runTest('RelationsService.block()', async () => {
      if (!targetUserId) return 'SKIPPED — no target user';
      try {
        await lastValueFrom(this.relationsService.block(targetUserId));
        return `OK — blocked user ${targetUserId}`;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (err?.status === 409) {
          return `409 Conflict (already blocking) — endpoint reachable`;
        }
        throw err;
      }
    });

    await this.runTest('RelationsService.unblock()', async () => {
      if (!targetUserId) return 'SKIPPED — no target user';
      try {
        await lastValueFrom(this.relationsService.unblock(targetUserId));
        return `OK — unblocked user ${targetUserId}`;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (err?.status === 404) {
          return `404 Not Found (was not blocking) — endpoint reachable`;
        }
        throw err;
      }
    });
  }
}
