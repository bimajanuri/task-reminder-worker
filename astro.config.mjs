import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
    output: 'server',
    adapter: cloudflare({
        mode: 'advanced', // Menghasilkan output yang bisa dibungkus (wrapped)
    }),
    integrations: [tailwind()],
});