/**
 * Photos per post. The API's limit is `PostLimits.MAX_PHOTOS` in coolture-aws, and the contract's
 * `maxItems`. Change all three together.
 */
export const MAX_POST_PHOTOS = 8;

/** Links per post. The API's limit is `PostLimits.MAX_LINKS`, and the contract's `maxItems`. Change all three together. */
export const MAX_POST_LINKS = 3;

/** As the API's `PostLinkDto`. */
export const MAX_LINK_LABEL = 40;
