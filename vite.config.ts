import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import dotenv from 'dotenv';

const config = dotenv.config({ path: '.env' }).parsed!;
const port: number = parseInt(config.PORT_WEB!);

export default defineConfig({
  plugins: [
    solidPlugin(),
    tailwindcss()
  ],
  server: {
    port,
    proxy: {
      '/api': {
        target: 'http://localhost:' + config.PORT_API,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('x-forwarded-for', req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress);
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  preview: {
    port
  }
});