import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/", "output/", "gauntlet-loop/", "node_modules/", "scripts/", "public/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Use RandomService (src/services/RandomService.ts) so runs stay replayable.",
        },
      ],
    },
  },
);
