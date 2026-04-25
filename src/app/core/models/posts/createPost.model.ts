export interface CreatePostModel {
  categoryId: string;
  title: string;
  startsAt: string;
  description: string;
  type: 'OFFLINE' | 'ONLINE';
}
