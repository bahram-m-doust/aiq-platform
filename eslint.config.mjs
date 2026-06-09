import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
<<<<<<< .merge_file_KXP1s9
    "public/pdf.worker.min.mjs",
=======
    // Vendored, minified third-party assets (e.g. pdf.js worker).
    "public/**",
>>>>>>> .merge_file_I04Gtj
  ]),
]);

export default eslintConfig;
