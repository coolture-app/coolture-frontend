import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PostCard } from '../../models/posts/post-card.model';
import { EventWhenService } from '../../services/event-when/event-when.service';
import { postPlace } from '../../models/posts/post-place';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMapPin } from '@ng-icons/heroicons/outline';
import { lucideChevronRight } from '@ng-icons/lucide';
import { MapFocus } from '../map/map-focus';

@Component({
  selector: 'app-event-card',
  imports: [TranslatePipe, NgIcon],
  viewProviders: [provideIcons({ heroMapPin, lucideChevronRight })],
  templateUrl: './event-card.html',
  styleUrl: './event-card.scss',
})
export class EventCard {
  @Input() post!: PostCard;
  @Output() cardClick = new EventEmitter<string>();

  private mapFocus = inject(MapFocus);
  readonly when = inject(EventWhenService);

  get place(): string {
    return postPlace(this.post);
  }

  showOnMap(event: Event): void {
    event.stopPropagation();
    this.mapFocus.show(this.post);
  }

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
