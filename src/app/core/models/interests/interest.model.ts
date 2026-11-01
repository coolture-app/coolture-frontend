export interface Interest {
  key: string;
  labelPl: string;
  labelEn: string;
}

export interface InterestCategory extends Interest {
  interests: Interest[];
}

export interface InterestCatalog {
  minSelections: number;
  maxSelections: number;
  categories: InterestCategory[];
}

export interface UserInterests {
  interests: string[];
}
