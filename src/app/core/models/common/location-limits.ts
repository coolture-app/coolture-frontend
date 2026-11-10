/** The API's limits on an event location's text, from `EventLocationDto` in coolture-aws. Change both together. */
export const LOCATION_LIMITS = {
  venueName: 64,
  street: 128,
  buildingNum: 16,
  postalCode: 16,
  city: 128,
} as const;
