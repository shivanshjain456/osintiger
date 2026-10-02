// Safe JSON parse utility — prevents crashes on corrupted/malformed JSON data.
// Used across the platform for parsing data from database columns, API responses,
// and LLM outputs that may contain malformed JSON.

/**
 * Safely parse a JSON string, returning a fallback value if parsing fails.
 * Prevents crashes from malformed JSON in database columns, API responses, etc.
 *
 * @param jsonStr - The JSON string to parse
 * @param fallback - The value to return if parsing fails (default: null)
 * @returns The parsed value or fallback
 */
export function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr || typeof jsonStr !== "string") return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely parse a JSON string as an array, returning an empty array if parsing fails
 * or the result is not an array.
 */
export function safeJsonArray(jsonStr: string | null | undefined): unknown[] {
  const parsed = safeJsonParse(jsonStr, []);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Safely parse a JSON string as an object, returning an empty object if parsing fails
 * or the result is not an object.
 */
export function safeJsonObject(jsonStr: string | null | undefined): Record<string, unknown> {
  const parsed = safeJsonParse(jsonStr, {});
  return (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};
}

/**
 * Safely parse a JSON string as a string array, filtering out non-string values.
 */
export function safeJsonStringArray(jsonStr: string | null | undefined): string[] {
  const arr = safeJsonArray(jsonStr);
  return arr.filter((v): v is string => typeof v === "string");
}
