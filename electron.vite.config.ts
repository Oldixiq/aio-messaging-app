import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Strict Content-Security-Policy for the shell. Development additionally needs
 * inline scripts and a websocket for React Fast Refresh.
 */
function contentSecurityPolicy(): Plugin {
  let dev = false;
  return {
    name: 'aio-csp',
    configResolved(config) {
      dev = config.command === 'serve';
    },
    transformIndexHtml(html) {
      const csp = [
        "default-src 'self'",
        dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        dev ? "connect-src 'self' ws: http://localhost:*" : "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
      ].join('; ');
      return html.replace('%CSP%', csp);
    },
  };
}

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@integrations': resolve(__dirname, 'src/integrations'),
};

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: { input: { main: resolve(__dirname, 'src/main/main.ts') } },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: {
          shell: resolve(__dirname, 'src/preload/shell.ts'),
          service: resolve(__dirname, 'src/preload/service.ts'),
        },
        // Sandboxed preloads cannot `require` arbitrary modules, so emit CJS.
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: { ...alias, '@renderer': resolve(__dirname, 'src/renderer/src') } },
    plugins: [react(), contentSecurityPolicy()],
    build: {
      minify: 'esbuild',
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
    },
  },
});
