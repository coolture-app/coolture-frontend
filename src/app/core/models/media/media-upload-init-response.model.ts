export interface MediaUploadInitResponse {
  mediaId: string; // UUID
  objectKey: string;
  uploadUrl: string; // Pre-signed PUT URL do S3
  httpMethod: 'PUT';
  expiresAt: string; // ISO-8601
  requiredHeaders: Record<string, string>;
}
