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
      rollupOptions: {
        output: {
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: "assets/[hash][extname]",
          onlyExplicitManualChunks: true,
          manualChunks(id) {
            if (
              id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-") ||
              id.includes("node_modules/victory-vendor")
            )
              return "charts";
            if (id.includes("node_modules/exceljs")) return "excel-export";
            if (id.includes("node_modules/pptxgenjs")) return "slides-export";
            if (id.includes("node_modules/jspdf")) return "pdf-export";
          },
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
