import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // keep every dependency in its own long-lived cache chunk; app code iterates fast
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) return "vendor";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
