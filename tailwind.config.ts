import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0D0D0D",
        surface: "#1A1A1A",
        "surface-2": "#252525",
        "neon-pink": "#FF2D55",
        "neon-gold": "#FFD600",
        "neon-green": "#00FF88",
        "text-primary": "#F5F5F5",
        "text-secondary": "#999999",
        "text-muted": "#555555",
      },
      boxShadow: {
        "neon-pink": "0 0 24px rgba(255, 45, 85, 0.45)",
        "neon-gold": "0 0 16px rgba(255, 214, 0, 0.30)",
        "neon-green": "0 0 14px rgba(0, 255, 136, 0.40)",
      },
      animation: {
        "pulse-neon": "pulse-neon 1.5s ease-in-out infinite",
        "rise": "rise 0.8s ease-out both",
        "wobble": "wobble 0.6s ease-in-out infinite",
        "flash": "flash 0.3s ease-in-out 3",
        "scale-in": "scale-in 0.2s ease-out",
        "bounce-once": "bounce-once 0.4s ease-in-out",
        "neon-flicker": "neon-flicker 9s ease-in-out infinite",
        "glow-pulse-pink": "glow-pulse-pink 2s ease-in-out infinite",
        "glow-pulse-white": "glow-pulse-white 2.2s ease-in-out infinite",
        "flip-in": "flip-in 0.3s ease-out",
        "btn-pop": "btn-pop 0.28s ease-out",
        "grow-bar": "grow-bar 0.5s ease-out both",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.7", filter: "brightness(1.4)" },
        },
        "rise": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "wobble": {
          "0%, 100%": { transform: "rotate(-5deg)" },
          "50%": { transform: "rotate(5deg)" },
        },
        "flash": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "bounce-once": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.25)" },
        },
        "flip-in": {
          "0%": { transform: "perspective(500px) rotateX(25deg) translateY(-6px)", opacity: "0" },
          "100%": { transform: "perspective(500px) rotateX(0deg) translateY(0)", opacity: "1" },
        },
        "btn-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
        "grow-bar": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
