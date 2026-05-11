# BDLV.me site strategy and implementation context

Date: 2026-05-05

This document captures the current product/content direction for `bdlv.me` and the recommended implementation approach. It is intended for the site owner and for future AI agents working in this repository.

## User Intent

The site should become an author-owned place for both experimental creative work and professional/commercial work.

Creative/art directions:

- AI-sorokaust: a page where a visitor hears a neural network praying.
- Design concepts for strange shops.
- 3D graphics and WebGL experiments.
- Mini-games and small interactive toys.
- Existing odd/art projects, texts, sticker packs, and experiments.

Professional/commercial directions:

- Sell products and services.
- Publish and improve product landing pages, especially for Musli.
- Write a blog/journal.
- Build landing pages and small interactive services on different topics.
- Keep the site useful as an author portfolio without making it feel like a generic portfolio.

## Editorial Positioning

Recommended framing:

`BDLV.me` is an author laboratory where Alexander makes strange interfaces, art projects, products, utilities, and AI experiments at the intersection of design, code, and product thinking.

The site should not hide the strange work, because it is part of the author's signal. But commercial product pages should have clean, focused paths so paid products are easy to understand, index, and buy/download.

## Recommended Site Structure

Organize by visitor intent, not by whether something is "serious" or "weird".

Suggested top-level sections:

```text
/
/lab/
/products/
/services/
/notes/
/about/
```

Suggested meanings:

- `/` - author portal and strongest first impression.
- `/lab/` - art projects, games, 3D, AI-sorokaust, strange shops, assorted experiments.
- `/products/` - products such as Musli, BlackNote, future apps, and small tools.
- `/services/` - professional offer: landing pages, product prototypes, AI tools, interactive microsites, design and implementation.
- `/notes/` - blog/journal: product notes, technical writeups, design thinking, process notes.
- `/about/` - who makes this, contact, credentials, links.

Product pages can live either under `/products/musli/` or stay at `/musli/` if the short URL is already useful. Preserve existing URLs when possible, or add redirects if URLs change.

## SEO And GEO/AI Search Notes

The site can combine art and commercial products without hurting promotion if the architecture is clear.

Important rules:

- Each paid product needs its own focused landing page.
- Product pages should not rely on the general project list for meaning.
- Product pages need clear title, H1, description, screenshots, FAQ, download/buy/contact CTA, and comparison/positioning.
- Use structured data where appropriate:
  - `WebSite` on the home page.
  - `Organization` or `Person` for the author/site.
  - `SoftwareApplication` for products like Musli.
  - `Article` for blog posts.
  - `BreadcrumbList` for section hierarchy.
- Generate `sitemap.xml`.
- Maintain `robots.txt`.
- Allow search crawlers that should surface the site, including `OAI-SearchBot`, unless there is a deliberate reason to opt out.
- Keep provocative, explicit, or sexually named art projects grouped in `/lab/` and avoid linking to specific provocative pages from commercial product navigation.
- Product navigation should link to "Lab" or "Projects" generally, not to the most provocative individual projects.

For AI search/GEO, pages should contain extractable factual blocks. Good product sections:

- What is it?
- Who is it for?
- What problem does it solve?
- How is it different from alternatives?
- Does data leave the device/cloud?
- What platforms are supported?
- What does it cost?
- What is the current version?
- Where can a user download or contact the author?

## Recommended Stack

Use Astro as the main site framework.

Recommended stack:

```text
Astro
TypeScript
MDX/Markdown content collections
SCSS or plain CSS
Three.js for 3D work
Canvas/WebGL for games and visual experiments
Web Audio API for audio art
Small PHP endpoints for forms and AI proxying on Sprinthost
```

Why Astro:

- Good fit for content-driven sites, portfolios, blogs, product pages, and landing pages.
- Static HTML by default, which is good for SEO, performance, and AI search.
- Supports interactive islands only where needed.
- Familiar to AI coding tools because it uses common HTML/CSS/JS/TS patterns.
- Works with static hosting and the existing `dist/` deploy model.

Do not use Next.js as the default site framework unless the site becomes a real application with authentication, dashboards, server-heavy routes, or other app features. For the current direction, Next.js is likely more operational complexity than value.

Eleventy would also be viable, but Astro is better here because the site needs richer interactive pages and componentized landing pages.

## Hosting Decision

The user wants to stay on Sprinthost for now.

This is possible and compatible with the recommended stack.

Current deployment model:

```text
GitHub Actions
  -> build locally on GitHub runner
  -> produce dist/
  -> rsync dist/ to Sprinthost public_html/
```

Keep this model. Astro can also build to `dist/`, so the deploy concept does not need to change.

Sprinthost capabilities relevant to this decision:

- Static files are served efficiently by nginx.
- Dynamic scripts are passed to Apache.
- PHP is a natural fit for small request handlers on shared hosting.
- Node.js is available, including modern versions, but Node apps run through Phusion Passenger and need extra `.htaccess`/process configuration.

## API And Interaction Architecture

For now, prefer this model:

```text
Astro static pages
  -> browser JS fetch()
  -> /api/*.php endpoints on Sprinthost
  -> external services such as email, Telegram, OpenAI/Anthropic/Gemini
```

Useful endpoints:

```text
/api/lead.php       - service/product lead form
/api/contact.php    - general contact form
/api/ask-ai.php     - AI answer endpoint
/api/waitlist.php   - beta signup or product waitlist
```

Why PHP first:

- Simpler on Sprinthost shared hosting.
- No Passenger app setup required.
- Good enough for forms, Telegram/email notifications, and simple AI request/response.
- Less operational fragility for a mostly static site.

When Node becomes justified:

- Streaming token responses are required.
- Many endpoints share non-trivial TypeScript logic.
- The site needs queues, long-running jobs, websockets/long polling, or a real API application.
- A future microservice needs to be maintained separately from the static site.

If Node becomes necessary, consider either:

- a Passenger Node app on Sprinthost, or
- a separate backend on a subdomain such as `api.bdlv.me`.

## AI API Safety

Never call paid AI APIs directly from browser JavaScript. API keys would leak.

Correct pattern:

```text
Frontend form/chat
  -> POST /api/ask-ai.php
  -> server-side AI API call
  -> sanitized response to frontend
```

Minimum safeguards for public AI endpoints:

- Store API keys outside `public_html`.
- Limit prompt and message length.
- Add honeypot and/or Cloudflare Turnstile if spam appears.
- Rate limit by IP or simple server-side log if abuse appears.
- Keep system prompts on the server.
- Do not log sensitive user input unless there is a clear reason.
- Return controlled error messages to users.

## Sprinthost Secret Handling

Because deploy uses `rsync --delete dist/ public_html/`, anything manually placed in `public_html/` may be deleted by the next deploy.

Therefore:

- Keep public PHP endpoint files in the repository so they are copied to `dist/`.
- Keep secrets outside the deploy directory, for example:

```text
/home/a0692796/private/bdlv.env.php
```

- PHP endpoint files can include that private config by absolute path.
- Do not commit secrets.

## Suggested Future Repo Shape

If/when migrating from the current Gulp/Panini setup to Astro:

```text
src/
  pages/
    index.astro
    lab/
      index.astro
      ai-sorokaust.astro
    products/
      index.astro
      musli.astro
    services.astro
    notes/
      index.astro
      [...slug].astro
  content/
    notes/
    projects/
    products/
  components/
  layouts/
  styles/
  scripts/
  public/
    api/
      lead.php
      ask-ai.php
```

Build output should still end up in `dist/` for the current deploy pipeline.

## Implementation Priorities

Recommended order:

1. Define site map and URL policy.
2. Decide whether Musli stays at `/musli/` or moves to `/products/musli/`.
3. Add SEO foundations: metadata, sitemap, robots, canonical URLs, structured data.
4. Create the new high-level navigation: Lab, Products, Services, Notes, About.
5. Build product page template.
6. Build lab/project page template.
7. Build notes/blog content model.
8. Add PHP endpoint for contact/lead forms.
9. Add a small AI endpoint only after form handling is stable.
10. Migrate current pages gradually, preserving working URLs.

## Practical Principle

Default to static. Add server code only where a user action needs it.

This keeps the site fast, cheap, SEO-friendly, easy for AI agents to edit, and compatible with Sprinthost.
