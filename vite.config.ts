import { defineConfig, loadEnv } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [solid()],
    server: {
      port: 5173,
      proxy: { "/api": "http://localhost:" + (env.PORT || "3000") },
    },
    build: { outDir: "dist", target: "esnext" },
  };
});
