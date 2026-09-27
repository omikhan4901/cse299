import next from "eslint-config-next";

export default [
  ...next,
  { ignores: [".next/**", "node_modules/**", "public/**"] },
  {
    // PDF templates are rendered once per export and hold no state, so small
    // helper components declared inside them are fine.
    files: ["src/pdf/templates/**"],
    rules: { "react-hooks/static-components": "off" },
  },
];
