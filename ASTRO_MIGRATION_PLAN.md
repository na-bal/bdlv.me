# Astro migration plan for BDLV.me

Date: 2026-05-05

This document describes how to migrate the current `bdlv.me` site from the existing Gulp/Panini setup to Astro while keeping the old production site working.

## Current Site Snapshot

Current source structure:

- 13 top-level HTML pages in `src/*.html`.
- 1 product landing page in `src/musli/index.html`.
- 4 Panini layouts in `src/layouts/`.
- 4 partials in `src/partials/`.
- Around 13 active SCSS block files in `src/assets/scss/blocks/`.
- Several JS interactives:
  - `go-to-penis` map script.
  - `maze-explorer`.
  - `wallpaper-room` runtime and scene.
  - `latest-updates` terminal animation.
  - `BlackNote` contenteditable page.
- Around 39 image files.
- `src/musli/` contains product download/appcast assets and is large because of DMG files.

The site is not huge, but it has enough custom styling and interactive work that the migration needs visual and behavioral QA.

## Effort Estimate

### Option A: Technical migration only

Goal: move to Astro while preserving the current design, pages, URLs, and behavior.

Estimated effort:

```text
25-40 hours
```

With AI assistance and tight scope, expect closer to:

```text
25-32 hours
```

This option should avoid large redesign, editorial restructuring, new blog architecture, and new API work during the first pass.

### Option B: Migration plus new site architecture

Goal: move to Astro and introduce the recommended site structure:

```text
/lab/
/products/
/services/
/notes/
/about/
```

Estimated effort:

```text
45-75 hours
```

This includes content model work, SEO structure, cleaner navigation, redirects, product templates, and project templates.

### Option C: Migration plus redesign plus new interactions

Goal: move to Astro, introduce new structure, redesign the main experience, add forms, add AI endpoint, and improve product pages.

Estimated effort:

```text
70-110 hours
```

This is closer to a new version of the site than a migration.

## Work Breakdown

### 1. Inventory and URL policy

Estimated effort:

```text
2-4 hours
```

Tasks:

- List all current public pages.
- Decide which URLs must remain stable.
- Decide which pages move to `/lab/`, `/products/`, `/notes/`, etc.
- Define redirects for changed URLs.
- Mark pages that should remain indexed, noindexed, or hidden.

### 2. Astro project setup

Estimated effort:

```text
3-5 hours
```

Tasks:

- Add Astro to the project or create an Astro migration branch.
- Configure build output to `dist/`.
- Add TypeScript support.
- Set up base layouts and shared components.
- Set up static asset handling.
- Keep deploy compatible with current GitHub Actions + rsync flow.

### 3. Shared layout and styling migration

Estimated effort:

```text
4-7 hours
```

Tasks:

- Port header, footer, head metadata, favicon, and Metrika.
- Port global SCSS/CSS.
- Port core layout classes and article/project patterns.
- Avoid redesign during this step unless explicitly chosen.

### 4. Page migration

Estimated effort:

```text
8-14 hours
```

Tasks:

- Convert current HTML pages to `.astro` pages or MDX/content entries.
- Fix relative asset paths.
- Preserve old visual layout.
- Check page-specific metadata.
- Keep process pages connected to project pages.

### 5. Interactive migration

Estimated effort:

```text
6-12 hours
```

Tasks:

- Move existing JS into Astro-compatible scripts/components.
- Verify `maze-explorer`, `wallpaper-room`, `go-to-penis`, terminal animation, and BlackNote behavior.
- Keep heavy or generated runtimes isolated so they do not pollute the main site bundle.
- Test desktop and mobile behavior.

### 6. Musli migration

Estimated effort:

```text
4-8 hours
```

Tasks:

- Preserve `/musli/` unless there is a strong reason to move it.
- Keep `appcast.xml` URL stable.
- Keep all DMG files published exactly where Sparkle expects them.
- Port landing page into Astro.
- Add product metadata and structured data later if not done in the first pass.

### 7. SEO/GEO foundation

Estimated effort:

```text
5-10 hours
```

Tasks:

- Add canonical URLs.
- Generate `sitemap.xml`.
- Add or update `robots.txt`.
- Add OpenGraph/Twitter metadata.
- Add JSON-LD for products, articles, breadcrumbs, and author/site.
- Make product pages extractable for AI search.

### 8. Sprinthost deploy update

Estimated effort:

```text
3-6 hours
```

Tasks:

- Replace `gulp build` with `astro build` in GitHub Actions when ready.
- Keep rsync to `/home/a0692796/domains/bdlv.me/public_html/`.
- Make sure static Musli assets are copied.
- Make sure PHP endpoints, if any, are included intentionally.
- Do one deploy only after staging/local verification.

### 9. QA and release

Estimated effort:

```text
5-10 hours
```

Tasks:

- Compare old and new pages visually.
- Check links, forms, scripts, images, downloads, and responsive views.
- Verify production build.
- Verify uploaded files on Sprinthost.
- Verify search-critical files: `robots.txt`, `sitemap.xml`, canonical URLs.

## Recommended Migration Approach

Use a staged migration, not a big-bang rewrite.

Recommended phases:

```text
Phase 1: Astro skeleton and current design parity
Phase 2: migrate current pages and Musli without changing production
Phase 3: add new structure and SEO foundations
Phase 4: add forms and AI endpoints
Phase 5: redesign or add new art/product pages
```

This keeps the first deliverable small enough to finish and verify.

## How To Keep The Old Site Working

The safest approach is:

```text
main branch        -> current production site
astro-migration    -> new Astro site in progress
```

Do not change the production deploy workflow until the Astro version is ready.

### Local development

Use local development for everyday work:

```text
npm run dev
```

or whatever Astro dev command is configured.

This is enough for most migration work:

- page layout;
- component development;
- styling;
- client-side interactives;
- content model work.

Local development is the default mode and should be used heavily before exposing anything publicly.

### Preview build locally

Before any remote staging:

```text
npm run build
npm run preview
```

This catches issues that only appear in production output, such as paths, missing assets, or generated routes.

### Public staging option 1: subfolder on the same domain

Deploy the new site to:

```text
https://bdlv.me/_next/
```

or:

```text
https://bdlv.me/_astro-preview/
```

Advantages:

- no DNS setup;
- easy to compare on the real host;
- real Sprinthost behavior;
- easy to password-protect or noindex.

Disadvantages:

- relative paths and canonical URLs must be handled carefully;
- not ideal for final URL testing;
- accidental indexing must be prevented.

If using this, add:

```text
<meta name="robots" content="noindex, nofollow">
```

and/or block the preview path in `robots.txt`.

### Public staging option 2: subdomain

Deploy the new site to:

```text
https://new.bdlv.me/
```

or:

```text
https://astro.bdlv.me/
```

Advantages:

- cleanest staging environment;
- closer to final production behavior;
- easier to test absolute paths;
- old site remains untouched.

Disadvantages:

- requires subdomain setup in Sprinthost/DNS;
- requires a second deploy target or manual staging deploy;
- must be noindexed and ideally password-protected.

This is the best public testing option if setup friction is acceptable.

### Public staging option 3: GitHub Pages or external preview host

Deploy the Astro branch to an external preview environment.

Advantages:

- does not touch Sprinthost production;
- easy preview links.

Disadvantages:

- not the same server behavior as Sprinthost;
- PHP endpoints will not work the same way;
- Musli/appcast paths may behave differently.

This is useful for visual review, but not ideal for final deploy verification.

## Recommended Testing Strategy

Use three levels:

### Level 1: local only

Best for day-to-day development.

Use for:

- page conversion;
- styling;
- component work;
- most client-side interactions.

### Level 2: temporary staging subdomain

Best before release.

Use for:

- real host checks;
- real asset paths;
- mobile checks from phone;
- sharing with another person;
- testing PHP form endpoints if added.

Recommended staging URL:

```text
https://astro.bdlv.me/
```

or:

```text
https://new.bdlv.me/
```

### Level 3: production switch

Only after:

- new site builds cleanly;
- visual checks pass;
- current important URLs work or redirect;
- Musli download and appcast work;
- SEO files are correct;
- noindex is removed from production pages and kept on staging.

## Production Switch Plan

When ready:

1. Freeze changes to the old Gulp site.
2. Build the Astro site.
3. Deploy Astro `dist/` to `public_html/`.
4. Check home page, project pages, Musli, appcast, downloads, and assets.
5. Check `robots.txt` and `sitemap.xml`.
6. Keep the old branch intact for rollback.

Rollback should be simple:

```text
re-run old production deploy from main
```

or keep a tagged old build artifact if needed.

## Recommendation

For this project, the best path is:

```text
1. Develop Astro version locally on a separate branch.
2. Add public staging on a Sprinthost subdomain only when the local version is mostly usable.
3. Keep current bdlv.me production untouched until the Astro version is verified.
4. Switch production by changing the existing GitHub Actions deploy to build Astro.
```

Do not deploy incomplete Astro work to the root domain. The current site should keep working while migration happens in parallel.

