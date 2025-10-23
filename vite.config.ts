import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

let chunkConfig = { core: [] };

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: "dist/stats.html",
      open: true,
      gzipSize: true,
    }) as any,
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const idIncludes = (keywords: string[] = []) =>
            keywords.some((x) => id.includes(x));

          if (idIncludes(["@mui", "ramda", ...(chunkConfig?.core ?? [])])) {
            return "core";
          }
        },
      },
    },
  },
});
