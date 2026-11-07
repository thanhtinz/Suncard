import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    navy: "#14213D", primary: "#2563EB", pagebg: "#FFF9F1",
    ok: "#16A34A", warn: "#F59E0B", danger: "#DC2626",
    sun1: "#FF8A3D", sun2: "#FFB03A", sun3: "#FFD93D", sundeep: "#E86A17",
    cream: "#FFF9F1", sunline: "#F3E3D3", ink2: "#22304D", muted2: "#6B7690",
  }, boxShadow: { soft: "0 8px 24px rgba(20,33,61,.06)", sun: "0 6px 18px rgba(255,138,61,.4)", sunsoft: "0 24px 50px rgba(232,106,23,.18)" } } },
  plugins: [],
};
export default config;
