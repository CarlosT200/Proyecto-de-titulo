/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
      },
      fontFamily: {
        sans: ["Open Sans", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      // Curva de salida fuerte para la interfaz (respuesta rapida, final suave).
      transitionTimingFunction: {
        salida: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      keyframes: {
        // Una cifra del panel que cambio con la actualizacion automatica se ilumina y se apaga.
        "cifra-cambio": {
          "0%": { opacity: 1 },
          "100%": { opacity: 0 },
        },
        "grid-drift": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "64px 64px" },
        },
        "window-glow": {
          "0%, 100%": { opacity: 0.3 },
          "50%": { opacity: 1 },
        },
        "horizon-glow": {
          "0%, 100%": { opacity: 0.5, transform: "scale(1)" },
          "50%": { opacity: 0.85, transform: "scale(1.06)" },
        },
        "beacon-blink": {
          "0%, 20%, 100%": { opacity: 0.15 },
          "10%": { opacity: 1 },
        },
      },
      animation: {
        "cifra-cambio": "cifra-cambio 1.2s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "grid-drift": "grid-drift 30s linear infinite",
        "window-glow": "window-glow 5s ease-in-out infinite",
        "horizon-glow": "horizon-glow 12s ease-in-out infinite",
        "beacon-blink": "beacon-blink 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
