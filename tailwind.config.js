/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          card: "#161b27",
          hover: "#1d2435",
          border: "#232d3f",
        },
        accent: {
          blue: "#60a5fa",
          purple: "#a78bfa",
          green: "#34d399",
          orange: "#fb923c",
          red: "#f87171",
          yellow: "#fbbf24",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
