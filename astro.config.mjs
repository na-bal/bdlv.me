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
      // /vacations/ — тоже: страницы поездок живут по прямой ссылке, из навигации
      // сайта на них ничего не ведёт, и в поиске им делать нечего.
      filter: (page) =>
        !/\/dev-(layout|layout-noheader|tokens)\/?$/.test(page) &&
        !/\/vacations(\/|$)/.test(page),
    }),
  ],
});
