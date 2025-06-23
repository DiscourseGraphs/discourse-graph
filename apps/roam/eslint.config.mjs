import base from "@repo/eslint-config/react-internal.js";

export default [
  ...base,
  {
    ignores: ["scripts/*.ts"],
  },
];
