import js from "@eslint/js";
import globals from "globals";

export default [
  {ignores: ["**/node_modules/", "dist/"]},
  js.configs.recommended,
  {
    rules: {
      "eqeqeq": "error",
      "no-empty": "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
      "max-lines": ["warn", {max: 250, skipBlankLines: true, skipComments: true}]
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    ignores: ["scripts/decisions/**"],
    languageOptions: {
      globals: {
        ...globals.browser, game: "readonly", canvas: "readonly", ui: "readonly", Hooks: "readonly",
        foundry: "readonly", CONFIG: "readonly", CONST: "readonly", DocumentSheet: "readonly", FilePicker: "readonly",
        getTemplate: "readonly", loadTemplates: "readonly", VideoHelper: "readonly", fromUuidSync: "readonly"
      }
    }
  },
  {
    // Decisions take values and return values. They must not use Foundry or browser globals (rule 1.3).
    files: ["scripts/decisions/**/*.mjs"],
    languageOptions: {globals: {}}
  },
  {
    files: ["tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {globals: globals.node}
  }
];
