import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('react-helmet-async')
          ) return 'react-vendor';
          if (
            id.includes('@radix-ui/') ||
            id.includes('class-variance-authority') ||
            id.includes('/clsx/') ||
            id.includes('tailwind-merge') ||
            id.includes('cmdk') ||
            id.includes('vaul')
          ) return 'radix-vendor';
          if (id.includes('@tanstack/')) return 'query-vendor';
          if (
            id.includes('i18next') ||
            id.includes('react-i18next') ||
            id.includes('i18next-browser-languagedetector')
          ) return 'i18n-vendor';
        },
      },
    },
  },
});
