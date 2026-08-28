import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        register: resolve(__dirname, "register.html"),
        customerRegister: resolve(__dirname, "customer-register.html"),
        requests: resolve(__dirname, "requests.html"),
        contact: resolve(__dirname, "contact.html"),
        ceo: resolve(__dirname, "ceo.html")
      }
    }
  }
});
