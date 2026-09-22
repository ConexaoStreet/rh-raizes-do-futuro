import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "./",
    build: { sourcemap: false, chunkSizeWarningLimit: 1400 },
    server: { port: 4173, strictPort: true, allowedHosts: ["terminal.local"] },
  };
});
