// Исторический changelog сайта. Эксперименты из /lab/*/_meta.ts подмешиваются
// автоматически на странице /lab/latest-updates/, поэтому здесь — только
// «крупные вехи» (версии, переезды, ключевые продукты).
//
// Голос — ироничный, личный, в духе оригинала 2021 года.

export type Line =
  | { kind: "input"; text: string; prompt?: string }
  | { kind: "plain"; html: string }
  | { kind: "progress" }
  | { kind: "spacer" };

export type Entry = {
  version: string;
  date: Date;
  lines: Line[];
  // Если true — сразу под заголовком этой версии вставляется список экспериментов
  // (auto-injected). Сейчас стоит на самой свежей версии.
  injectExperiments?: boolean;
};

export const historicalChangelog: Entry[] = [
  {
    version: "2.0",
    date: new Date("2026-05-09"),
    injectExperiments: true,
    lines: [
      { kind: "input", text: "pip install BDLV 2.0" },
      { kind: "progress" },
      { kind: "plain", html: "Сайт переехал на новые рельсы. Снова." },
      { kind: "spacer" },
      { kind: "input", text: "BDLV 2.0 [09.05.2026]" },
      {
        kind: "input",
        prompt: ">>>",
        text: "Полностью переписан движок: с Gulp на Astro 6. Старый Gulp выкинут, статика теперь честная.",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Дизайн-система собрана в одни токены — типографика, цвета, отступы.",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Каждая страница покрыта e2e-спецификацией на Playwright. Без неё ничего больше не катится в прод.",
      },
      { kind: "spacer" },
    ],
  },
  {
    version: "1.5",
    date: new Date("2025-10-01"),
    lines: [
      { kind: "input", text: "BDLV 1.5 [осень 2025]" },
      {
        kind: "input",
        prompt: ">>>",
        text: "Запущен Musli — отдельное macOS-приложение для записи звука со встреч (Zoom, Meet и прочих).",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Локальная транскрибация и диаризация прямо на маке. Без облака.",
      },
      { kind: "spacer" },
    ],
  },
  {
    version: "1.4",
    date: new Date("2025-01-31"),
    lines: [
      { kind: "input", text: "BDLV 1.4 [31.01.2025]" },
      {
        kind: "input",
        prompt: ">>>",
        text: "Добавлен Maze Explorer — Doom-style лабиринт на raycasting.",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Туда же — мобильное управление через экранный D-pad.",
      },
      { kind: "spacer" },
    ],
  },
  {
    version: "1.3",
    date: new Date("2024-06-01"),
    lines: [
      { kind: "input", text: "BDLV 1.3 [где-то в 2024]" },
      { kind: "input", prompt: ">>>", text: "Подключён GitHub Actions для автодеплоя." },
      { kind: "input", prompt: ">>>", text: "Добавлен проект BlackNote." },
      { kind: "input", prompt: ">>>", text: "Завезён фавикон. Маленькая радость." },
      { kind: "spacer" },
    ],
  },
  {
    version: "1.0",
    date: new Date("2021-11-20"),
    lines: [
      { kind: "input", text: "BDLV 1.0 [20.11.2021]" },
      {
        kind: "input",
        prompt: ">>>",
        text: "Сайт полностью переехал на новые рельсы. Сборка — Gulp, вёрстка — CSS Grid.",
      },
      {
        kind: "plain",
        html: '<span class="prompt">&gt;&gt;&gt;</span> Добавлен проект <a href="/lab/go-to-penis/">«Иди на х🦆й»</a>.',
      },
      {
        kind: "plain",
        html: '<span class="prompt">&gt;&gt;&gt;</span> Добавлен проект <a href="/lab/pantone-colors/">«Pantone Colors»</a>.',
      },
      {
        kind: "plain",
        html: '<span class="prompt">&gt;&gt;&gt;</span> Добавлен проект <a href="/lab/wallpaper-room/">«Комната с обоями»</a>.',
      },
      { kind: "spacer" },
    ],
  },
  {
    version: "0.2",
    date: new Date("2021-08-04"),
    lines: [
      { kind: "input", text: "BDLV 0.2 [04.08.2021]" },
      {
        kind: "input",
        prompt: ">>>",
        text: "Добавлена страница «Процесс» для проекта.",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Добавлен этот псевдотерминал, чтобы я мог сообщать, что обновилось на сайте.",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Все ссылки теперь красиво подсвечиваются.",
      },
      { kind: "spacer" },
    ],
  },
  {
    version: "0.1",
    date: new Date("2021-07-25"),
    lines: [
      { kind: "input", text: "BDLV 0.1 [25.07.2021]" },
      {
        kind: "input",
        prompt: ">>>",
        text: "Это незабываемый сайт. Классно, что ты сюда попал.",
      },
      {
        kind: "input",
        prompt: ">>>",
        text: "Я пока не знаю зачем он нужен.",
      },
    ],
  },
];
