// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://bdlv.me',
  output: 'static',
  srcDir: 'src',
  publicDir: 'public',
  outDir: 'dist',
  integrations: [
    sitemap({
      // Исключаем dev-страницы — они не публичные.
      filter: (page) => !/\/dev-(layout|layout-noheader|tokens)\/?$/.test(page),
    }),
  ],
});
