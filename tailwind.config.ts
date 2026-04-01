import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // No default color palette — Markzo uses CSS variables exclusively
    colors: {},
    extend: {
      spacing: {},
      fontFamily: {},
    },
  },
  plugins: [],
  corePlugins: {
    // Keep layout/spacing utilities, disable color-based ones we don't use
    preflight: true,
  },
};
export default config;
