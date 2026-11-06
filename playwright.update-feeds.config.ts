import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:['appcast-counter.spec.ts','windows-counter.spec.ts','htaccess.spec.ts'],fullyParallel:true,workers:4,reporter:'list',outputDir:'test-results/update-feeds'});
