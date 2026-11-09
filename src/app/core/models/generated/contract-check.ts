// Would the hand-written models accept what the contract says the API returns?
// A compile error on a line below means that model disagrees with feed-api.yaml. See `npm run api-types`.
import type { components } from './feed-api';
import type { FeedPage } from '../posts/feed-page.model';
import type { PostCard } from '../posts/post-card.model';
import type { PostMark } from '../posts/post-mark.model';
import type { PaginatedResponse } from '../common/paginated-response.model';

type Schemas = components['schemas'];
type Accepts<Model, Actual extends Model> = Actual;

export type ContractCheck = [
  Accepts<PostCard, Schemas['PostCard']>,
  Accepts<PaginatedResponse<PostCard>, Schemas['PostPage']>,
  Accepts<FeedPage, Schemas['FeedPage']>,
  Accepts<PostMark, Schemas['PostMark']>,
];
