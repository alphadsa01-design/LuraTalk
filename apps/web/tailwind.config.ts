import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "420px",
      },
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        surface: "#0a0a0a",
        surfaceLight: "#141414",
        primary: {
          DEFAULT: "#ffffff",
          hover: "#e5e5e5",
          glow: "rgba(255, 255, 255, 0.18)",
        },
        secondary: {
          DEFAULT: "#a1a1aa",
          hover: "#d4d4d8",
          glow: "rgba(255, 255, 255, 0.1)",
        },
        accent: {
          pink: "#ffffff",
          emerald: "#e4e4e7",
          amber: "#a1a1aa",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ripple": "ripple 2.5s cubic-bezier(0, 0.2, 0.8, 1) infinite",
        "glow": "glow 3s ease-in-out infinite alternate",
      },
      keyframes: {
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)" },
          "100%": { boxShadow: "0 0 35px rgba(255, 255, 255, 0.2)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

