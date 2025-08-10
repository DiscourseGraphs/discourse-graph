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
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      preferArrows,
    },
    rules: {
      "max-params": ["error", 3],
      "@typescript-eslint/naming-convention": [
        "error",
        // Default: camelCase for most identifiers
        { selector: "default", format: ["camelCase"] },
        // Const variables can be camelCase or UPPER_CASE
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "UPPER_CASE"],
        },
        // Types, interfaces, enums, type aliases in PascalCase
        { selector: "typeLike", format: ["PascalCase"] },
        // Allow PascalCase for function variables (e.g., React components)
        {
          selector: "variable",
          types: ["function"],
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
    plugins: {
      onlyWarn,
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
