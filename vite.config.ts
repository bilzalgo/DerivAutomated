import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  plugins: [react()],
  publicDir: "public",
  server: {
    host: "0.0.0.0",
    proxy: { "/api": "http://localhost:3001" },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});