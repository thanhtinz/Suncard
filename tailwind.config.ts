import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    navy: "#14213D", primary: "#2563EB", pagebg: "#F5F7FB",
    ok: "#16A34A", warn: "#F59E0B", danger: "#DC2626",
  }, boxShadow: { soft: "0 8px 24px rgba(20,33,61,.08)" } } },
  plugins: [],
};
export default config;
