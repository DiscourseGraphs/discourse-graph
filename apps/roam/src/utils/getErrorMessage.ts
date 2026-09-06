/**
 * The message to show for something that was thrown, wherever it came from.
 *
 * Lives on its own because both sides of an import need it: `materializeSharedNode` for
 * its stage failures, and the asset stage it calls for the ones it reports instead of
 * throwing. Putting it in either would make the other import its caller.
 *
 * Supabase reports a failed query as a plain object carrying `message`, not as an
 * `Error`, so a message is read from either shape. Stringifying the object instead would
 * put `[object Object]` in front of the one person who needs to know what went wrong.
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string") return message;
  }
  return String(error);
};
