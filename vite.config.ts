import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "src/widget"),
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist/widget"),
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      input: {
        widget: resolve(__dirname, "src/widget/widget.html"),
        embed: resolve(__dirname, "src/widget/embed.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "embed") {
            return "embed.js";
          }
          if (chunkInfo.name === "widget") {
            return "widget.js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "styles.css") {
            return "assets/styles.css";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
