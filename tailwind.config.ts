import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#eef2f8", 100: "#d6dfee", 600: "#24406e", 700: "#1b3157", 800: "#142543", 900: "#0d1a30" },
      },
    },
  },
  plugins: [],
} satisfies Config;
