/**
 * Helper functions for Firestore operations
 */

/**
 * Removes undefined values from an object
 * Firestore doesn't allow undefined values
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key as keyof T] = value;
    }
  }
  return cleaned;
}

/**
 * Removes undefined and null values, converting null to undefined for optional fields
 */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      cleaned[key as keyof T] = value;
    }
  }
  return cleaned;
}

