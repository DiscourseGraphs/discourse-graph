/**
 * The message to show for something that was thrown, wherever it came from.
 *
 * Shared by `materializeSharedNode` and the asset stage it calls. In either file, the
 * other would have to import its caller.
 *
 * Supabase reports a failed query as a plain object carrying `message`, not an `Error`,
 * so read both shapes. Stringifying the object yields `[object Object]`.
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string") return message;
  }
  return String(error);
};
