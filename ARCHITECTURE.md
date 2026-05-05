# bdlv.me — Архитектура миграции на Astro

Дата формирования: 2026-05-06
Статус: финализированный по итогам проектной сессии.

Документ фиксирует архитектурные решения, принятые при подготовке миграции `bdlv.me` с текущего стека (Gulp/Panini) на Astro. Он дополняет два более ранних документа (`ASTRO_MIGRATION_PLAN.md` — техническая декомпозиция; `SITE_STRATEGY.md` — продуктовая стратегия) и **отменяет любые конфликтующие решения** в их пользу.

Документ предназначен для:
- автора (как якорь, чтобы не дрейфовать в пути),
- AI-агентов в этом репозитории (как контекст до начала любой работы).

---

## Резюме

bdlv.me становится **авторской многорежимной платформой** на Astro. Не маркетинговая воронка, не классическое портфолио. Большая часть сайта живёт по правилам выразительности, маленькая часть (продуктовые страницы) — по правилам продуктового лендинга. Эти части визуально и риторически разделены.

Миграция выполняется в две фазы. Phase 1 — каркас + `/lab/` + перенос текущей главной + базовые SEO-сигналы. Phase 2 — новый Musli лендинг с нуля.

Целевая стратегия: **B+** (по терминологии `ASTRO_MIGRATION_PLAN.md`) — структура B как фундамент, обновления C добавляются итеративно.

---

## 1. Стратегия миграции — B+

Не A (только перенос — не даёт ни архитектуры, ни дизайна), не C (всё разом — риск зависнуть). Гибрид: новая структура закладывается фундаментом, дизайн обновляется покомпонентно при переносе каждой страницы, фичи C (формы, AI) — после стабилизации каркаса.

Каждая итерация автономна. Можно остановиться на любой странице, и сайт остаётся консистентным в текущем состоянии.

### Фазы

```
Phase 1 — Skeleton + /lab/ + перенос главной + базовые SEO
Phase 2 — Новый Musli лендинг с нуля
Phase 3+ — По мере накопления контента и запросов:
           /notes/, /services/, /about/, формы, etc.
```

---

## 2. Posture сайта

Сайт — **многорежимная авторская платформа**, не воронка. Три режима:

1. **Default — выражение и развлечение.** Большая часть страниц (`/lab/`, `/notes/`). Не оптимизируется ни по каким метрикам, кроме внутреннего «интересно/неинтересно».

2. **Контекстный коммерческий режим.** Когда автор скидывает конкретную ссылку как продуктовое предложение. Эта **отдельная страница** должна работать как продуктовая. Не весь сайт.

3. **Случайная виральность как бонус.** Не цель, но не мешаем — сайт должен быть SEO-приличным.

### Hygiene floor (не цели, а условия)

- Сайт не должен быть фундаментально SEO-враждебным (canonical, sitemap, robots, OG, JSON-LD).
- LCP на топ-страницах < 2.5s.
- Sparkle URL `bdlv.me/musli/appcast.xml` НЕ ломается никогда.

### Что НЕ оптимизируется

- Vanity-метрики, дашборды, «growth» фрейминг.
- Поисковая органика как KPI (нет цели — есть только пол «не уронить, что есть»).

---

## 3. Языки (i18n)

Astro i18n включён на сайте с дня один. **RU default, EN добавляется по мере появления переводов.**

```
Default URL: /<page>     → всегда RU
EN URL:      /en/<page>  → если перевод существует;
                           иначе страница не генерится
```

### Поведение

- **Switcher** показывается только когда для текущей страницы существует EN-версия. До накопления переводов он почти везде скрыт.
- **Fallback** на RU при отсутствии EN.
- **Auto-detection** по `Accept-Language` на первом визите. **НЕ по IP** (VPN-проблема: пользователи из России часто заходят через зарубежные VPN).
- **Manual override** — если пользователь явно выбрал, выбор сохраняется и уважается.

### Implementation детали — отложены

- Где именно живёт логика детекции (клиентский JS или Apache `.htaccess`).
- URL-параметр `?lang=...` — поведение.
- Per-page override через frontmatter.

---

## 4. URL карта и редиректы

### Базовая структура

```
/                          — главная
/lab/                      — лаборатория экспериментов
/lab/<slug>/               — отдельный эксперимент
/lab/<slug>/process/       — закулисье эксперимента (опционально)
/products/                 — каталог продуктов
/products/musli/           — лендинг Musli
/notes/                    — заметки (СКРЫТО на Phase 1)
/services/                 — услуги (СКРЫТО на Phase 1)
/about/                    — об авторе (СКРЫТО на Phase 1)

/en/<...>                  — зеркало для EN-локали
```

### Стиль URL

- **Полные слова**: `/products/`, `/lab/`, `/notes/`, не `/p/`, `/l/`, `/n/`.
- **Lowercase, kebab-case**.
- **С trailing slash**: `/lab/cactus/`.
- **Slug стабилен**: после публикации не меняется.

### Миграция старых URL — все 410

Сайт не имеет органического трафика, который стоило бы сохранять. Все старые URL отдают **410 Gone**:

```
/index.html                    → 410 (canonical /)
/projects.html                 → 410
/cactus.html                   → 410
/cactus-process.html           → 410
/go-to-penis.html              → 410
/latest-updates.html           → 410
/maze-explorer.html            → 410
/my-sex-tape.html              → 410
/my-sex-tape-process.html      → 410
/pantone-colors.html           → 410
/pantone-colors-process.html   → 410
/wallpaper-room.html           → 410
/b.html                        → 410

/musli/                        → 301 → /products/musli/
                                  (Phase 1: редирект на старый лендинг
                                   до готовности нового; Phase 2: на новый)
/musli/appcast.xml             → ОСТАЁТСЯ ЖИТЬ как 200 OK навсегда
                                  (Sparkle-критичный URL — см. #5)
/musli/<DMG-files>             → 410 (новые DMG в /products/musli/)
```

Реализация — `.htaccess` в `astro/public/.htaccess`.

### Маппинг старого контента в новую структуру

Старые URL отдают 410, но контент **переносится и адаптируется** в новую структуру:

```
cactus.html                  → /lab/cactus/
cactus-process.html          → /lab/cactus/process/
go-to-penis.html             → /lab/go-to-penis/
latest-updates.html          → /lab/latest-updates/
maze-explorer.html           → /lab/maze-explorer/
my-sex-tape.html             → /lab/my-sex-tape/
my-sex-tape-process.html     → /lab/my-sex-tape/process/
pantone-colors.html          → /lab/pantone-colors/
pantone-colors-process.html  → /lab/pantone-colors/process/
wallpaper-room.html          → /lab/wallpaper-room/
b.html                       → /lab/blacknote/
projects.html                → нет замены, навигация заменяется
```

---

## 5. Appcast.xml — Sparkle constraint

### Permanent legacy URL

**`bdlv.me/musli/appcast.xml`** — never moves, never redirects, always 200 OK.

У установленных Musli у пользователей этот URL зашит в `Info.plist` (`SUFeedURL`). Sparkle делает запрос именно сюда. Если URL ломается — обновления молча перестают работать у всех существующих установок.

### Реализация

```
astro/public/musli/appcast.xml
  → Astro копирует public/ как есть в dist/
  → rsync деплоит в bdlv.me/musli/appcast.xml
```

### Поведение для новых сборок Musli

Новые сборки Musli **продолжают использовать тот же URL** (`bdlv.me/musli/appcast.xml`). Не вводим новый URL.

Содержимое appcast.xml обновляется так, чтобы **ссылки на DMG внутри XML** указывали на новые URL `/products/musli/<file>.dmg`. Sparkle качает DMG по тем URL, которые видит в XML — он не привязан к старому пути.

### DMG-файлы

- Новые DMG: `/products/musli/<file>.dmg`.
- Старые URL DMG (`/musli/<file>.dmg`): 410 (консистентно с #4).
- При миграции **критично** перенести актуальные DMG в `astro/public/products/musli/` ДО переключения деплоя — иначе rsync `--delete` сотрёт их с сервера.

### Будущая graduation на subdomain

Если когда-нибудь Musli уедет на `musli.bdlv.me`:
- `bdlv.me/musli/appcast.xml` ОБЯЗАН продолжать работать.
- Способ — копия файла на bdlv.me, синхронизируется с musli.bdlv.me.
- Это будущая забота, упоминается как permanent legacy constraint.

### Архитектурный cleanup отложен

Решение «ввести канонический `/products/musli/appcast.xml` + копия на старом» — отложено. Если Musli мигрирует на subdomain, тогда и решаем. Сейчас один URL живёт по своему пути как технический долг — это не мешает.

---

## 6. Контент-модель

### Только одна Astro content collection

**`/notes/` — collection.** Записи однотипны (Markdown с frontmatter), стандартный рендер `<article>`.

```typescript
// astro/src/content/config.ts
const notes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
    pinned: z.boolean().default(false),
  }),
});
```

### `/lab/` и `/products/` — кастомные страницы с co-located metadata

Каждый эксперимент / продукт — папка с `index.astro` (полностью кастомная страница) + `_meta.ts` (metadata для индексной страницы) + локальные стили / ассеты.

```
astro/src/pages/lab/
  index.astro                   ← /lab/ (индекс)
  cactus/
    index.astro                 ← /lab/cactus/
    process.astro               ← /lab/cactus/process/
    _meta.ts                    ← metadata
    cover.png
    styles.scss
  go-to-penis/
    index.astro
    _meta.ts
    ...

astro/src/pages/products/
  index.astro                   ← /products/ (каталог)
  musli/
    index.astro                 ← /products/musli/
    _meta.ts
    ...
```

`_meta.ts` пример:

```typescript
export const meta = {
  title: 'Cactus',
  description: 'Короткое описание для карточки',
  date: new Date('2024-03-12'),
  cover: './cover.png',
  type: 'static',
  tags: ['art'],
  hasProcess: true,
  processLinkLabel: 'За сценой',  // опционально
  pinned: false,
  draft: false,
};
```

`type` принимает значения: `page | webgl | game | audio | static | interactive`.

Index-страницы `/lab/` и `/products/` собираются через `import.meta.glob` по всем `_meta.ts` файлам.

### Свобода в `/lab/`

Каждый `/lab/<slug>/index.astro` — полноценная Astro-страница со своими импортами, скриптами, стилями. Может использовать глобальные дизайн-токены, может полностью игнорировать. Изоляция стилей — естественная.

### i18n внутри коллекций / страниц

Суффикс языка в имени файла:
- `astro/src/content/notes/<slug>/index.md` (RU)
- `astro/src/content/notes/<slug>/index.en.md` (EN)
- `astro/src/pages/lab/cactus/index.astro` (RU)
- `astro/src/pages/lab/cactus/index.en.astro` (EN)

### Одиночные страницы

```
/                  — astro/src/pages/index.astro
/about/            — astro/src/pages/about.astro    (СКРЫТО Phase 1)
/services/         — astro/src/pages/services.astro (СКРЫТО Phase 1)
```

---

## 7. Pattern проект+процесс

### Принципы

- **`/lab/` — витрина экспериментов**, не портфолио проектов.
- Эксперимент опционально имеет парную страницу процесса (закулисье).
- Парные страницы живут в одной папке: `index.astro` + `process.astro`.
- В индексе `/lab/` показывается **только эксперимент**. Процесс — sub-page.
- UI-связь двусторонняя: с эксперимента приглашение в процесс, с процесса — возврат через breadcrumbs.

### Edge-cases

- Эксперимент без процесса — нормально. `_meta.ts` имеет `hasProcess: false`.
- Процесс без эксперимента — нет, такие мысли идут в `/notes/`.
- Несколько процессов у одного эксперимента — не закладываем сейчас.

---

## 8. Phase 1 — что должно быть готово к запуску

### Содержание

```
/                  → перенос текущей главной (большая картинка + текст)
                     минимальная доработка, без редизайна

/lab/              → все 8 экспериментов мигрированы
                     ✓ index.astro для каждого
                     ✓ process.astro для тех, у кого был
                     ✓ _meta.ts с описанием
                     ✓ обложки (cover.png)

/products/         → каталог-страница с одной карточкой Musli
                     (BlackNote → /lab/blacknote/, не в /products/)

/products/musli/   → ВРЕМЕННЫЙ редирект на /musli/ (старый лендинг)
                     полноценный лендинг — Phase 2

/notes/            → СКРЫТО, не в навигации, страница не существует
/services/         → СКРЫТО
/about/            → СКРЫТО

Навигация в шапке: Lab, Products. Всё.
```

### SEO / технические базовые

- `sitemap.xml` (только реально существующие страницы).
- `robots.txt`.
- canonical URLs на всех страницах.
- OG/Twitter meta на ключевых страницах.
- JSON-LD `Person` (с Telegram-заглушкой через `sameAs`, без email) на главной.
- JSON-LD `WebSite` на главной.
- `.htaccess` с 410-правилами.

### Phase 2 — после запуска

- Новый Musli лендинг с нуля по уже имеющимся намёткам.
- JSON-LD `SoftwareApplication` на /products/musli/.
- Удаление временного редиректа `/products/musli/` → `/musli/`.

---

## 9. Voice principles

### Один автор, разная температура по разделам

- `/lab/` — расслабленно, провокация и юмор уместны.
- `/products/` — спокойно, профессионально, никакой провокации.
- `/notes/` — рефлексивно, серьёзно но живо.
- `/about/` — кратко и честно, без саморекламы.

### Адресация

| Где                            | К себе | К читателю |
|--------------------------------|--------|------------|
| `/lab/`, `/notes/`, `/about/`  | я      | ты         |
| `/products/`                   | я      | вы         |

### Стиль

- Простой русский, без маркетингового и английского жаргона.
- Технические термины оставляем (UI, API, ML, build).
- Эмоджи минимально и осмысленно.
- Литературность: разговорно-прямой стиль базовый, можно уходить в образный в `/lab/` и `/notes/`.

### Длины

- Карточки `/lab/`: 1-2 предложения.
- Страницы `/lab/`: длина по содержанию.
- `/products/musli/`: 800-1500 слов, секционно.
- `/notes/`: от 300 слов.
- `/about/`: 200-400 слов.

### Forbidden

- «Узнайте, как X изменит вашу жизнь».
- «Команда профессионалов».
- «Современное решение для современных задач».
- Любой текст, который мог бы стоять на любом другом сайте.

---

## 10. Дизайн-система

### Иерархия токенов

```
global (tokens.css)         → CSS Custom Properties
  ↓ section (layout)        → переопределение per-layout
    ↓ page                  → /lab/<slug>/ может игнорировать всё
```

Глобальные токены — это **подсказки, не правила**. Базовые цвета, типографика, spacing scale используются header'ом, footer'ом, навигацией, `/products/`, `/notes/`. `/lab/` страницы — полностью свободны.

### Тема

- **Одна тема** (без dark/light свитчера на старте).
- Конкретный режим определяется при извлечении палитры из текущего сайта.

### Источник токенов

Извлекаем из текущего SCSS:
- Палитру.
- Типографику: Roboto + Roboto Slab. Open Sans удалить — не используется.
- Spacing scale.

Упрощаем при переносе. Финальные значения — на этапе реализации.

### Asymmetry — продуктовая зона отдельно

`/products/musli/` — отдельная визуальная зона. Может вообще не иметь связи с основным сайтом visually:
- Свой header или его отсутствие.
- Свои токены или независимая дизайн-система.
- Цель: лендинг работает standalone, как будто остального сайта не существует.

Эта асимметрия — **сознательная конструкция**. Большая часть сайта — арт-территория, маленькая часть — продуктовая, и они визуально разделены.

---

## 11. Performance бюджет

### Целевые метрики (топ-страницы)

| Метрика                          | Цель      |
|----------------------------------|-----------|
| LCP (Largest Contentful Paint)   | < 2.5s    |
| INP (Interaction to Next Paint)  | < 200ms   |
| CLS (Cumulative Layout Shift)    | < 0.1     |
| Lighthouse Performance           | > 90      |

`/lab/<experiment>/` — освобождены от Performance score (могут быть тяжёлыми по содержанию: WebGL, анимации). Cross-page bloat невозможен — каждая страница изолирована.

### JS policy

| Раздел                                       | Бюджет JS                       |
|----------------------------------------------|---------------------------------|
| `/`, `/lab/` index, `/notes/`, `/about/`     | 0kb (статика)                   |
| `/lab/<experiment>/`                         | свободно по содержанию          |
| `/products/musli/`                           | минимально, осознанно           |
| Header / footer                              | vanilla JS, без фреймворков     |

### Картинки

- Astro `<Image>` везде, кроме интерактивных контекстов.
- Auto-conversion в WebP/AVIF.
- Lazy-loading по умолчанию.
- Hero на топ-страницах: priority loading.

### Шрифты

- **Self-hosted** через `@fontsource/roboto` + `@fontsource/roboto-slab`.
- Только нужные веса (400, 700, может 300).
- `font-display: swap` обязательно.
- Preload только критичный вес.
- **Open Sans удалить** — текущий импортирует, но не использует.
- **Fira Mono** локально только на странице `/lab/latest-updates/`.

---

## 12. Формы, лиды, контакты

### На запуске — никаких форм

- Никаких серверных endpoints.
- Никаких контактных форм.
- Никаких mailto:, никаких контактов в footer.

### JSON-LD на запуске

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Alexander Bedelev",
  "url": "https://bdlv.me",
  "sameAs": [
    "https://t.me/<placeholder>"
  ]
}
```

(Telegram handle — заглушка до решения автора.)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://bdlv.me",
  "name": "bdlv.me"
}
```

### Phase 2 и далее

- `SoftwareApplication` JSON-LD на `/products/musli/`.
- `Article` JSON-LD на `/notes/`, когда раздел появится.
- Формы — только при появлении конкретного кейса (без преждевременной инфраструктуры).
- AI-эндпоинты — только при появлении конкретного кейса.

### Hard rule

Никаких форм без сервера. Никаких форм с `mailto:` в `action`. (`mailto:` hyperlink вне формы — ок.)

---

## 13. Где живёт код

### Во время миграции

```
bdlv.me/
├── ARCHITECTURE.md            ← ЭТОТ документ
├── ASTRO_MIGRATION_PLAN.md    ← существующий план (исторический)
├── SITE_STRATEGY.md           ← существующая стратегия (исторический)
├── CLAUDE.md
├── ai/
├── dev-notes/
├── src/                       ← LEGACY Gulp source
├── dist/                      ← LEGACY build output (.gitignore)
├── gulpfile.mjs               ← LEGACY
├── babel.config.mjs           ← LEGACY
├── package.json               ← LEGACY (Gulp deps)
├── package-lock.json          ← LEGACY
├── node_modules/              ← LEGACY (.gitignore)
└── astro/                     ← НОВЫЙ Astro проект
    ├── astro.config.mjs
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── node_modules/          ← .gitignore
    ├── src/
    │   ├── pages/
    │   ├── content/
    │   ├── components/
    │   ├── layouts/
    │   └── styles/
    ├── public/
    │   ├── .htaccess
    │   └── musli/
    │       ├── appcast.xml    ← legacy URL preserved
    │       └── (DMG files)
    └── dist/                  ← .gitignore
```

### После запуска Phase 1

Один большой коммит "switch to Astro":

1. Перемещаем `astro/*` на корень.
2. Удаляем `src/`, `gulpfile.mjs`, `babel.config.mjs`, корневые `package.json`, `package-lock.json`.
3. Обновляем `.github/workflows/deploy.yml`.
4. Тег `v1-final-gulp` на предыдущий коммит для отката.
5. Пушим в main → деплой автоматически переключается.

### GitHub Actions после Phase 1

```yaml
name: Deploy to bdlv.me

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # pngquant/libimagequant больше не нужны:
      # Astro использует sharp из npm

      - run: npm install
      - run: npm run build

      - name: Setup SSH key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy
        run: |
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/deploy_key -p ${{ secrets.SSH_PORT }}" \
            dist/ \
            ${{ secrets.SSH_USERNAME }}@${{ secrets.SSH_HOST }}:/home/${{ secrets.SSH_USERNAME }}/domains/bdlv.me/public_html/

      - if: always()
        run: rm -f ~/.ssh/deploy_key
```

Ключевые отличия от текущего:
- `node-version: 18` → `20` (LTS).
- Удалён шаг с `pngquant/libimagequant-dev`.
- `npx gulp build` → `npm run build`.

---

## Риски и точки контроля при переключении

### Перед switch-коммитом — обязательная проверка

- [ ] `astro/public/musli/appcast.xml` существует и валиден.
- [ ] Актуальные DMG-файлы в `astro/public/products/musli/`.
- [ ] `astro/public/.htaccess` содержит все 410-правила.
- [ ] `.htaccess` редиректит `/musli/` на `/products/musli/`, **но НЕ** `/musli/appcast.xml`.
- [ ] `cd astro && npm run build` собирается без ошибок.
- [ ] `cd astro && npm run preview` показывает работающий сайт.
- [ ] Локально: `dist/musli/appcast.xml` существует после билда.
- [ ] Тег `v1-final-gulp` поставлен на коммит ДО переключения.

### После запуска — проверка

- [ ] `https://bdlv.me/musli/appcast.xml` отдаёт 200 OK с валидным XML.
- [ ] DMG в appcast.xml ссылаются на `/products/musli/<file>.dmg`.
- [ ] Скачивание DMG по новому URL работает.
- [ ] `https://bdlv.me/cactus.html` отдаёт 410.
- [ ] `https://bdlv.me/lab/cactus/` отдаёт нормальную страницу.
- [ ] Lighthouse Performance > 90 на главной, `/lab/`, `/products/`.
- [ ] `sitemap.xml` валиден.

---

## Открытые вопросы (отложенные)

Эти решения сознательно отложены — они либо уточняются на этапе реализации, либо ждут конкретного триггера:

- Конкретные значения дизайн-токенов (палитра, размеры, шрифтовые scale).
- Точное поведение i18n-свитчера в edge-case'ах.
- URL-параметр `?lang=...`.
- Per-page i18n override через frontmatter.
- Контент `/services/`, `/about/`, `/notes/`.
- Subdomain для Musli (graduation pipeline).
- Формы и AI-эндпоинты.
- Telegram handle для JSON-LD `sameAs`.
- Header на `/products/musli/`: свой или его отсутствие.
- Детали навигации после удаления `/projects.html`.
- Стратегия очистки дубликата `src/assets/scss/blocks 2/` (видимо, забытая копия).

---

## Якоря для AI-агентов

При работе в этом репозитории AI-агенты должны:

1. **Сначала читать этот файл** перед любыми архитектурными изменениями.
2. **Не предлагать формы, AI-эндпоинты, метрики, vanity-counter'ы** без явного запроса.
3. **Не трогать `/musli/appcast.xml`** — это permanent legacy URL для Sparkle, ломать категорически нельзя.
4. **Соблюдать voice asymmetry** — провокация и эклектика в `/lab/`, спокойствие в `/products/`.
5. **Не оптимизировать `/lab/<experiment>/` под Performance budget** — там свобода.
6. **Использовать простой русский** в копирайте; технический жаргон — только когда без него никак.
7. **Не вводить новые URL без обновления `ARCHITECTURE.md`** — если архитектурное решение меняется, сначала меняется этот документ.

---

## Ссылки

- `ASTRO_MIGRATION_PLAN.md` — техническая декомпозиция миграции (исторический контекст, оценки часов).
- `SITE_STRATEGY.md` — продуктовая стратегия и позиционирование (исторический контекст).
- Sparkle docs — https://sparkle-project.org/documentation/
- Astro docs — https://docs.astro.build/

---

*Документ — живой. Меняется при изменении архитектуры. Старые решения не удаляются, только обновляются с пометкой даты изменения.*
