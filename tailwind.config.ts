import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#070707",
        panel: "#141414",
        line: "#252525",
        mist: "#f3f0e8",
        coral: "#ff6b5f",
        mint: "#8de0c2"
      }
    }
  },
  plugins: []
} satisfies Config;
