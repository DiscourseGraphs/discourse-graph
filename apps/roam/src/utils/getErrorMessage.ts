/**
 * The message to show for something that was thrown. Supabase reports a failed query as a
 * plain object carrying `message` rather than an `Error`, and stringifying that yields
 * `[object Object]`, so both shapes are read.
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string") return message;
  }
  return String(error);
};
