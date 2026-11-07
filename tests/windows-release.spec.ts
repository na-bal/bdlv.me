import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
const base='/products/musli/windows/';
test('Windows update feed points at the signed x64 installer',async({request})=>{
 const response=await request.get(base+'latest.json');
 expect(response.status()).toBe(200);
 const feed=await response.json();
 expect(feed.version).toBe('0.1.6');
 expect(feed.platforms['windows-x86_64'].url).toBe('https://bdlv.me'+base+'Musli_0.1.6_x64-setup.exe');
 expect(Buffer.from(feed.platforms['windows-x86_64'].signature,'base64').toString()).toContain('untrusted comment:');
});
test('Windows installer is served in full and matches its published checksum',async({request})=>{
 const sums=await (await request.get(base+'SHA256SUMS')).text();
 const [hash,name]=sums.trim().split(/\s+/);
 expect(hash).toMatch(/^[0-9a-f]{64}$/);
 expect(name).toBe('Musli_0.1.6_x64-setup.exe');
 const response=await request.get(base+name);
 expect(response.status()).toBe(200);
 const bytes=await response.body();
 expect(bytes.subarray(0,2).toString()).toBe('MZ');
 expect(bytes.length).toBe(Number(response.headers()['content-length']));
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
 expect((await request.get(base+encodeURIComponent('README-установка.html'))).status()).toBe(200);
});
