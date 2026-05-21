/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0e2a4a", 2: "#1a3a5c" },
        bluex: { DEFAULT: "#1862a8", soft: "#e6eef7" },
        teal: { DEFAULT: "#167b7b", soft: "#e1eeee" },
        violet: { DEFAULT: "#5b4fcf", soft: "#ede9ff" },
        amber: { DEFAULT: "#b45309", soft: "#fef3c7" },
        slate2: "#64748b",
      },
      fontFamily: {
        body: ['"Source Sans 3"', "Calibri", "system-ui", "sans-serif"],
        display: ['"Source Serif 4"', "Cambria", "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
