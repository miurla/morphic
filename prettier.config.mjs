/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("prettier-plugin-tailwindcss").PluginOptions} TailwindConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PrettierConfig} IanvsSortImportsConfig */

/** @type { PrettierConfig | IanvsSortImportsConfig | TailwindConfig } */
const config = {
  printWidth: 80,
  tabWidth: 2,
  semi: true,
  trailingComma: "all",
  bracketSpacing: true,
  endOfLine: "lf",
  importOrder: [
    "^(react/(.*)$)|^(react$)",
    "^(next/(.*)$)|^(next$)",
    "<THIRD_PARTY_MODULES>",
    "^types$",
    "^@/types/(.*)$",
    "^@/app/(.*)$",
    "^@/components/(.*)$",
    "^@/lib/(.*)$",
    "^[./]",
  ],
  tailwindConfig: "./tailwind.config.ts",
  tailwindFunctions: ["cn"],
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
};

export default config;
