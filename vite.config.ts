import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The faces the first screen is set in, fetched alongside the page instead of
 * after its styles. Without this the words are laid out in a fallback first
 * and jump when the real face arrives.
 */
function preloadFonts(faces: RegExp[]): Plugin {
  return {
    name: "preload-fonts",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        return Object.keys(ctx.bundle ?? {})
          .filter((file) => faces.some((face) => face.test(file)))
          .map((file) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              href: `/${file}`,
              crossorigin: "",
            },
            injectTo: "head" as const,
          }));
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    preloadFonts([
      /geist-latin-wght-normal.*\.woff2$/,
      /instrument-serif-latin-400-italic.*\.woff2$/,
    ]),
  ],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2500,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
