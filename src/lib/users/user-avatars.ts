export const USER_AVATARS_BUCKET = "user-avatars";

export function getUserAvatarStoragePath(userId: string, fileName: string): string {
  return `${userId}/${fileName}`;
}

export function getUserAvatarPublicUrl(userId: string, fileName: string): string {
  const path = getUserAvatarStoragePath(userId, fileName);
  // Will be replaced with actual Supabase URL at runtime
  return `/storage/v1/object/public/${USER_AVATARS_BUCKET}/${path}`;
}

export const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isValidAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, WebP, and GIF images are allowed",
    };
  }

  if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Avatar image must be 2MB or smaller",
    };
  }

  return { valid: true };
}
