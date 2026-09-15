import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules", "prisma/migrations"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // Non-blocking under time pressure: a lot of handlers intentionally
      // take an unused (err) or destructure params they don't all use.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
