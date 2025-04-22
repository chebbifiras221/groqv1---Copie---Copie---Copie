import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Define both dark and light theme colors
const darkTheme = {
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

const lightTheme = {
  primary: {
    DEFAULT: "#0969da",
    hover: "#0969da",
    focus: "#0969da",
    muted: "#0969da80",
  },
  secondary: {
    DEFAULT: "#8250df",
    hover: "#6e40c9",
    focus: "#5a32a3",
  },
  success: {
    DEFAULT: "#1a7f37",
    hover: "#2ea043",
    focus: "#238636",
  },
  danger: {
    DEFAULT: "#cf222e",
    hover: "#a40e26",
    focus: "#86061d",
  },
  warning: {
    DEFAULT: "#9a6700",
    hover: "#7d4e00",
    focus: "#633c01",
  },
  bg: {
    primary: "#ffffff",
    secondary: "#f6f8fa",
    tertiary: "#eaeef2",
    overlay: "#f6f8fa",
    inset: "#f6f8fa",
    inverse: "#0d1117",
  },
  border: {
    DEFAULT: "#d0d7de",
    muted: "#eaeef2",
    subtle: "#1b1f241a",
  },
  text: {
    primary: "#24292f",
    secondary: "#57606a",
    tertiary: "#6e7781",
    placeholder: "#6e778180",
    disabled: "#8c959f",
    inverse: "#ffffff",
    link: "#0969da",
    danger: "#cf222e",
    success: "#1a7f37",
    warning: "#9a6700",
    white: "#ffffff",
  },
  accent: {
    emphasis: "#0969da",
    muted: "#ddf4ff",
    subtle: "#ddf4ff80",
  },
  neutral: {
    emphasis: "#6e7781",
    muted: "#6e77811a",
    subtle: "#6e77810d",
  },
  canvas: {
    DEFAULT: "#ffffff",
    overlay: "#f6f8fa",
    inset: "#f6f8fa",
  },
};

const custom = {
  // Use dark theme as default
  ...darkTheme
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
