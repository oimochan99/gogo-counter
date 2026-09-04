/** @type {import('tailwindcss').Config} */
// Ported verbatim from the inline `tailwind.config` that used to sit next to the Play CDN script.
const inlineConfig = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "background": "#0a0a0a",
                "on-surface": "#e6e1e6",
                "on-surface-variant": "#d0c6ab",
                "surface": "#141316",
                "surface-container": "#211f23",
                "surface-container-low": "#1c1b1f",
                "surface-container-lowest": "#0f0e11",
                "surface-container-high": "#2b292d",
                "surface-container-highest": "#363438",
                "primary": "#fff5dc",
                "primary-container": "#ffd60a",
                "primary-fixed": "#ffe171",
                "neon-pink": "#ff1dce",
                "cyan": "#00e5ff",
                "gold": "#ffd700",
                "g1": "#3b82f6",
                "g2": "#22d3ee",
                "g3": "#a3e635",
                "g4": "#facc15",
                "g5": "#fb923c",
                "g6": "#ef4444"
            },
            spacing: {
                "xs": "4px", "sm": "12px", "md": "24px", "lg": "40px", "xl": "64px",
                "base": "8px", "gutter": "16px",
                "margin-desktop": "32px", "margin-mobile": "16px"
            }
        }
    }
};

module.exports = {
  content: ["./*.html", "./tool/*.html", "./tool/assets/*.js"],
  ...inlineConfig,
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
