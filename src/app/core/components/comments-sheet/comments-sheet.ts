import { InitialsPipe } from '../../pipes/initials.pipe';
import { Component, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { CommentsSheetService } from '../../services/comments-sheet/comments-sheet.service';
import { CommentThread } from '../comment-thread/comment-thread';
import { PostFriendsList } from '../post-friends/post-friends';
import { Sheet } from '../sheet/sheet';

/**
 * The comments of a post in the feed, or its friends list, in a sheet. Docked beside the feed, another card's comment
 * button or friends line just switches the panel. The address bar shows the post's link, with #comments or #friends,
 * while it's open.
 */
@Component({
  selector: 'app-comments-sheet',
  imports: [InitialsPipe, RouterLink, TranslatePipe, CommentThread, PostFriendsList, Sheet],
  templateUrl: './comments-sheet.html',
  styleUrl: './comments-sheet.scss',
})
export class CommentsSheet {
  readonly sheet = inject(CommentsSheetService);
  private shell = viewChild(Sheet);

  close(): void {
    this.shell()?.close();
  }
}
