import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
import preferArrows from "eslint-plugin-prefer-arrow-functions";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommendedTypeChecked, // added TypeChecked
  {
    plugins: {
      turboPlugin,
      preferArrows,
      onlyWarn,
    },
    rules: {
      "turboPlugin/no-undeclared-env-vars": "warn",
      "max-params": ["error", 3],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/naming-convention": [
        "error",
        // Keep default
        { selector: "default", format: ["camelCase"] },
        // Keep default for const
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "UPPER_CASE"],
        },
        // Keep default for types
        { selector: "typeLike", format: ["PascalCase"] },
        // Allow PascalCase for function variables (e.g., React components)
        {
          selector: "variable",
          types: ["function"],
          format: ["camelCase", "PascalCase"],
        },
        // Allow PascalCase for React imports
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],
      "preferArrows/prefer-arrow-functions": [
        "warn",
        {
          allowNamedFunctions: false,
          classPropertiesAllowed: false,
          disallowPrototype: false,
          returnStyle: "unchanged",
          singleReturnOnly: false,
        },
      ],
    },
  },
  {
    ignores: [
      "dist/**",
      // Addition: ignore dotfiles and config
      "node_modules/**",
      ".*.js",
      "*.config.*",
    ],
  },
];
