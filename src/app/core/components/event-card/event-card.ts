import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { PostCard } from '../../models/posts/post-card.model';
import { DateFormatService } from '../../services/date-format/date-format.service';
import { postPlace } from '../../models/posts/post-place';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMapPin } from '@ng-icons/heroicons/outline';
import { lucideChevronRight } from '@ng-icons/lucide';
import { MapFocus } from '../map/map-memory';

@Component({
  selector: 'app-event-card',
  imports: [TranslatePipe, DatePipe, NgIcon],
  viewProviders: [provideIcons({ heroMapPin, lucideChevronRight })],
  templateUrl: './event-card.html',
  styleUrl: './event-card.scss',
})
export class EventCard {
  @Input() post!: PostCard;
  @Output() cardClick = new EventEmitter<string>();

  private dateFormatService = inject(DateFormatService);
  private mapFocus = inject(MapFocus);
  readonly dateFormats = this.dateFormatService.formats;

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
