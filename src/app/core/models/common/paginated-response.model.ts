export interface PaginationInfo {
  cursor: string;
  limit: number;
}

export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: PaginationMeta;
}
