export function validateNodeFormat(format: string): {
  isValid: boolean;
  error?: string;
} {
  if (!format) {
    return {
      isValid: false,
      error: "Format cannot be empty",
    };
  }

  if (format.includes("[[") || format.includes("]]")) {
    return {
      isValid: false,
      error:
        "Format should not contain double brackets [[ or ]], these will be added automatically",
    };
  }

  const hasVariable = /{[a-zA-Z]+}/.test(format);
  if (!hasVariable) {
    return {
      isValid: false,
      error: "Format must contain at least one variable in {varName} format",
    };
  }

  return { isValid: true };
}
