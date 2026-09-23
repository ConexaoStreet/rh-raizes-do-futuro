import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "./",
    build: {
      sourcemap: false,
      minify: "terser",
      chunkSizeWarningLimit: 1400,
      terserOptions: {
        compress: {
          passes: 2,
          drop_console: true,
          drop_debugger: true,
        },
        mangle: true,
        format: {
          comments: false,
          ascii_only: true,
        },
      },
      rolldownOptions: {
        output: {
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: "assets/[hash][extname]",
        },
      },
    },
    server: {
      port: 4173,
      strictPort: true,
      allowedHosts: ["terminal.local"],
    },
  };
});
