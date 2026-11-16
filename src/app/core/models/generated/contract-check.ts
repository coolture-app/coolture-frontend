// Would the hand-written models accept what the contracts say the API returns, and would the API accept what they send?
// A compile error on a line below means that model disagrees with a contract. See `npm run api-types`.
import type { components as Feed } from './feed-api';
import type { components as Users } from './users-api';
import type { FeedPage } from '../posts/feed-page.model';
import type { PostCard } from '../posts/post-card.model';
import type { PostMark } from '../posts/post-mark.model';
import type { PostFriends } from '../posts/friend-stances.model';
import type { PaginatedResponse } from '../common/paginated-response.model';
import type { NamedPlace } from '../common/geo.model';
import type { Me, UserProfile } from '../users/user-profile.model';
import type { UserSummary } from '../users/user-summary.model';
import type { UserProfileUpdateRequest } from '../users/user-profile-update-request.model';
import type { InterestCatalog, UserInterests } from '../interests/interest.model';

type FeedSchemas = Feed['schemas'];
type UserSchemas = Users['schemas'];
type Accepts<Model, Actual extends Model> = Actual;

export type ContractCheck = [
  Accepts<PostCard, FeedSchemas['PostCard']>,
  Accepts<PaginatedResponse<PostCard>, FeedSchemas['PostPage']>,
  Accepts<FeedPage, FeedSchemas['FeedPage']>,
  Accepts<PostMark, FeedSchemas['PostMark']>,
  Accepts<PostFriends, FeedSchemas['PostFriends']>,
  Accepts<Me, UserSchemas['Me']>,
  Accepts<UserProfile, UserSchemas['UserProfile']>,
  Accepts<PaginatedResponse<UserSummary>, UserSchemas['UserPage']>,
  Accepts<NamedPlace, UserSchemas['Home']>,
  Accepts<InterestCatalog, UserSchemas['InterestCatalog']>,
  Accepts<UserInterests, UserSchemas['UserInterests']>,
  // What the frontend sends, the other way round.
  Accepts<UserSchemas['Home'], NamedPlace>,
  Accepts<UserSchemas['UserProfileUpdate'], UserProfileUpdateRequest>,
  Accepts<UserSchemas['UserInterests'], UserInterests>,
];
