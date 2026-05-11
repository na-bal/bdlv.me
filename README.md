# bdlv.me

Личный сайт Александра Беделева — лаборатория экспериментов и небольшие продукты.

Собран на [Astro](https://astro.build) (статика), деплоится на собственный VPS через GitHub Actions + rsync.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm install` | поставить зависимости |
| `npm run dev` | dev-сервер на `localhost:4321` |
| `npm run build` | прод-билд в `dist/` |
| `npm run preview` | посмотреть прод-билд локально |
| `npx playwright test` | прогнать e2e тесты (порт 4331 — не конфликтует с другими `astro dev` на машине) |

## Структура

```
src/
├── pages/         маршруты сайта (.astro → URL)
│   ├── lab/       эксперименты (/lab/<slug>/), у каждого _meta.ts для индекса
│   └── products/  каталог продуктов
├── layouts/       RootLayout (head/meta), PageLayout (вёрстка)
├── components/    общие + lab/
├── styles/        дизайн-токены, шрифты
└── data/          changelog для /lab/latest-updates/

public/            ассеты копируются в dist/ как есть
├── .htaccess      Apache: 410 на легаси-URL, 301 /musli/ → /products/musli/,
│                  pass-through для /musli/appcast.xml, cache headers
├── musli/         appcast.xml (Sparkle feed — URL не меняется никогда)
└── products/musli/ последние 3 DMG-сборки Musli

tests/             Playwright e2e (TDD-red workflow)
ai/                планы фаз и задач (gitignored для команды)
.archive/          архивные исходники
  ├── v1-gulp/     старый Gulp-сайт (до миграции, для истории)
  └── wallpaper-room/ self-hosted Spline scene для /lab/wallpaper-room/
```

## Деплой

`.github/workflows/deploy.yml` на каждый push в `main`:
1. Node 22 + `npm install`
2. `npm run build` → `dist/`
3. rsync `dist/` → VPS (`--delete`, поэтому `public/` обязан содержать всё статичное — `.htaccess`, `appcast.xml`, DMG)

## Контекст

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — почему всё именно так
- [`SITE_STRATEGY.md`](./SITE_STRATEGY.md) — позиционирование и принципы контента
- [`ASTRO_MIGRATION_PLAN.md`](./ASTRO_MIGRATION_PLAN.md) — план миграции с Gulp

Откатиться на Gulp-версию: `git checkout v1-final-gulp`.
