import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Default employee UUID for the training platform
export const DEFAULT_USER_ID = '86dbb941-690f-46ab-9221-5038ff985173';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate and resolve userId. Returns DEFAULT_USER_ID if input is missing or not a valid UUID. */
export function resolveUserId(userId: string | null | undefined): string {
  if (userId && UUID_REGEX.test(userId)) return userId;
  return DEFAULT_USER_ID;
}
