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
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // External APIs, generated database types, route maps, and host app
        // integration points often require exact property names.
        {
          selector: [
            "objectLiteralProperty",
            "objectLiteralMethod",
            "typeProperty",
          ],
          format: null,
        },
        // Allow exact external field names when destructuring API/database data.
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        // Allow local names that intentionally mirror database identifiers.
        {
          selector: ["variable", "parameter"],
          filter: {
            regex:
              "^(?:[a-z][a-z0-9]*_)*(?:id|ids|uid|uids|t)$|^(?:last_modified|literal_content)$",
            match: true,
          },
          format: null,
        },
        // Allow compact geometry helper names used by tldraw relation logic.
        {
          selector: "variable",
          filter: {
            regex: "^(?:[A-Z]\\d+|handle_[A-Za-z0-9]+)$",
            match: true,
          },
          format: null,
        },
        // Keep default for const
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Keep default for types
        { selector: "typeLike", format: ["PascalCase"] },
        // Allow PascalCase for function variables (e.g., React components)
        {
          selector: "variable",
          types: ["function"],
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Allow PascalCase for function declarations used as React components
        // or tldraw SVG helper components.
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Allow conventional ignored callback parameters.
        {
          selector: "parameter",
          modifiers: ["unused"],
          format: null,
        },
        // Allow constants and state names required by class-based libraries.
        {
          selector: "classProperty",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Support common enum member conventions.
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "enum",
          format: ["PascalCase", "UPPER_CASE"],
        },
        // Allow PascalCase for React imports
        {
          selector: "import",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
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
