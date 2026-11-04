import { FeedMode } from '../common/enums';
import { PaginatedResponse } from '../common/paginated-response.model';
import { PostCard } from './post-card.model';

export interface FeedPage extends PaginatedResponse<PostCard> {
  mode: FeedMode;
}
