export type ValidationIssue = {
  path: readonly string[];
  message: string;
};

export type ValidationResult =
  | {
      success: true;
      issues: readonly [];
    }
  | {
      success: false;
      issues: readonly ValidationIssue[];
    };

export const createValidResult = (): ValidationResult => ({
  success: true,
  issues: [],
});
