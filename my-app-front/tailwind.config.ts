import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const custom = {
  // GitHub-inspired dark theme colors
  primary: {
    DEFAULT: "#2188ff",
    hover: "#0366d6",
    focus: "#044289",
    muted: "#0366d680",
  },
  secondary: {
    DEFAULT: "#6e40c9",
    hover: "#5a32a3",
    focus: "#4c2889",
  },
  success: {
    DEFAULT: "#2ea043",
    hover: "#238636",
    focus: "#1a7f37",
  },
  danger: {
    DEFAULT: "#f85149",
    hover: "#da3633",
    focus: "#b62324",
  },
  warning: {
    DEFAULT: "#e3b341",
    hover: "#d29922",
    focus: "#bb8009",
  },
  bg: {
    primary: "#0d1117",
    secondary: "#161b22",
    tertiary: "#21262d",
    overlay: "#1c2128",
    inset: "#010409",
    inverse: "#ffffff",
  },
  border: {
    DEFAULT: "#30363d",
    muted: "#21262d",
    subtle: "#6e76811a",
  },
  text: {
    primary: "#e6edf3",
    secondary: "#7d8590",
    tertiary: "#6e7681",
    placeholder: "#6e768180",
    disabled: "#484f58",
    inverse: "#0d1117",
    link: "#58a6ff",
    danger: "#f85149",
    success: "#56d364",
    warning: "#e3b341",
    white: "#ffffff",
  },
  accent: {
    emphasis: "#1f6feb",
    muted: "#388bfd1a",
    subtle: "#388bfd0d",
  },
  neutral: {
    emphasis: "#6e7681",
    muted: "#6e76811a",
    subtle: "#6e76810d",
  },
  canvas: {
    DEFAULT: "#0d1117",
    overlay: "#161b22",
    inset: "#010409",
  },
};

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        ...colors,
        ...custom,
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'outline': '0 0 0 3px rgba(66, 153, 225, 0.5)',
        'none': 'none',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
