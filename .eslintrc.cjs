module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  env: {
    es2022: true
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: ["dist", "node_modules", ".next", "coverage"],
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      extends: ["next/core-web-vitals"],
      parserOptions: {
        project: null
      }
    },
    {
      files: ["apps/server/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
      env: {
        node: true
      }
    }
  ]
};
