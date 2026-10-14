import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        register: resolve(import.meta.dirname, "register.html"),
        customerRegister: resolve(import.meta.dirname, "customer-register.html"),
        customerLogin: resolve(import.meta.dirname, "customer-login.html"),
        requests: resolve(import.meta.dirname, "requests.html"),
        contact: resolve(import.meta.dirname, "contact.html"),
        ceo: resolve(import.meta.dirname, "ceo.html")
      }
    }
  }
});
