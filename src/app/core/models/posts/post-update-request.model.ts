import { PostCreateRequest } from './post-create-request.model';
/** `links` replaces the saved ones and an empty list removes them; `endsAt: null` removes the end. */
export type PostUpdateRequest = Partial<PostCreateRequest>;
