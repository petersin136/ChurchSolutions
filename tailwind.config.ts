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
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        none: "0",
        sm: "7px",
        DEFAULT: "7px",
        md: "7px",
        lg: "7px",
        xl: "7px",
        "2xl": "7px",
        "3xl": "7px",
        full: "9999px",
      },
      colors: {
        surface: "var(--surface)",
        blue: "var(--blue)",
        green: "var(--green)",
        orange: "var(--orange)",
        red: "var(--red)",
        purple: "var(--purple)",
        "text1": "var(--text1)",
        "text2": "var(--text2)",
        "text3": "var(--text3)",
        // Design System v1 — 디자이너 핸드오프 컬러 토큰
        "app-black": "#0b0c0e",
        "app-white": "#f4f4f6",
        "app-gray": "#a0a5b1",
        "lavender": "#c7b0ff",
        "citrus-green": "#e0e446",
        "peach": "#ffe8d2",
        "sunset-orange": "#ff7144",
        "glacier-blue": "#d8e6ff",
        "app-blue": "#334ed8",
        "deep-green": "#33473b",
        "app-pink": "#ffa9ff",
      },
    },
  },
  plugins: [],
};
export default config;
