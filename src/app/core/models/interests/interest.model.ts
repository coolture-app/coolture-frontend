export interface Interest {
  key: string;
  labelPl: string;
  labelEn: string;
}

/** A kind of event: a format someone goes to, such as a concert or a workshop. */
export type Kind = Interest;

export interface InterestCategory extends Interest {
  interests: Interest[];
}

export interface InterestCatalog {
  minKinds: number;
  minInterests: number;
  maxInterests: number;
  kinds: Kind[];
  /** Only the topics offered in onboarding. Someone may still hold a hidden one from before. */
  categories: InterestCategory[];
}

export interface UserInterests {
  kinds: string[];
  interests: string[];
}
