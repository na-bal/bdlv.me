// Метаданные эксперимента. Подхватываются индексной страницей /lab/.
export const meta = {
  title: "Последние обновления",
  description:
    "Псевдотерминал, который построчно печатает changelog сайта. Обновляется автоматически при каждом деплое.",
  date: new Date("2021-08-04"),
  cover: "/lab/latest-updates/images/cover.svg",
  type: "interactive" as const,
  category: "unsorted" as const,
  tags: ["terminal", "changelog", "termynal"],
  hasProcess: false,
  pinned: false,
  draft: false,
};
