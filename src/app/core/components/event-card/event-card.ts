import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { PostCard } from '../../models/posts/post-card.model';

@Component({
  selector: 'app-event-card',
  imports: [TranslatePipe, DatePipe],
  templateUrl: './event-card.html',
  styleUrl: './event-card.scss',
})
export class EventCard {
  @Input() post!: PostCard;
  @Output() cardClick = new EventEmitter<string>();

  onClick(): void {
    this.cardClick.emit(this.post.id);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.cardClick.emit(this.post.id);
    }
  }
}
