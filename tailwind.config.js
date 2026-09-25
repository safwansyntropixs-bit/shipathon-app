/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./utils/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        gold: "#F0B35C",
        brand: {
          bgLight: "#121212",
          bgSand: "#161616",
          card: "#2A2A2A",
          forest: "#2F6B47",
          sage: "#8FAE8E",
          charcoal: "#F7F6F3",
          grey: "#9F9F99",
          divider: "rgba(255,255,255,0.1)",
          success: "#3FA76A",
          warning: "#F0B35C",
          gold: "#F0B35C",
          error: "#D85C5C",
        },
      },
      fontFamily: {
        outfitReg: ["OutfitRegular"],
        outfitMed: ["OutfitMedium"],
        outfitBold: ["OutfitBold"],
        outfitBlack: ["OutfitBlack"],
      },
    },
  },
  plugins: [],
};
