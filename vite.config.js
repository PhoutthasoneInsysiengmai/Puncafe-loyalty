import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["unworried-courier-doorbell.ngrok-free.dev"],
  },
});
