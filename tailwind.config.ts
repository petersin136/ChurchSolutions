import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font)", "Inter", "Noto Sans KR", "system-ui", "sans-serif"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        blue: "var(--blue)",
        green: "var(--green)",
        orange: "var(--orange)",
        red: "var(--red)",
        purple: "var(--purple)",
        "text1": "var(--text1)",
        "text2": "var(--text2)",
        "text3": "var(--text3)",
      },
    },
  },
  plugins: [],
};
export default config;
