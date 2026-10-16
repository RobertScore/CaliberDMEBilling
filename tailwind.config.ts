import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Caliber brand: deep navy with a calm teal accent.
        navy: { 50: "#f0f4fa", 100: "#dde6f3", 200: "#bccce6", 300: "#8ea8d2", 400: "#5c7db8", 500: "#3d5f9c", 600: "#2c4a80", 700: "#223b68", 800: "#1a2e52", 900: "#121f38", 950: "#0b1424" },
        accent: { 50: "#ecfdf8", 100: "#d1faee", 200: "#a6f3dd", 300: "#6de8c8", 400: "#34d3ad", 500: "#14b892", 600: "#0a9477", 700: "#0b7662", 800: "#0d5d4f", 900: "#0d4d42" },
        canvas: "#f5f7fb",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        lift: "0 10px 30px -12px rgba(16,24,40,.25)",
      },
      borderRadius: { xl: "14px", "2xl": "18px" },
      fontSize: { "2xs": ["11px", "14px"] },
    },
  },
  plugins: [],
} satisfies Config;
