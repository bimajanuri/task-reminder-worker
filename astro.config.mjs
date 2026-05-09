import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react'; // Tambahkan ini

export default defineConfig({
    output: 'server',
    adapter: cloudflare({
        mode: 'advanced', // Menghasilkan dist/_worker.js/index.js
    }),
    integrations: [
        tailwind(),
        react() // Aktifkan integrasi React
    ],
});