export interface PaginationInfo {
  cursor: string;
  limit: number;
}

export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor?: string; // only when hasMore is true
}

export interface PaginatedResponse<T> {
  items: T[];
  page: PaginationMeta;
}
