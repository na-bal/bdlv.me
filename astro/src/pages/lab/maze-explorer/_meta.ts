// Метаданные эксперимента. Подхватываются индексной страницей /lab/.
export const meta = {
  title: "Лабиринт",
  description:
    "Doom-style лабиринт с настоящими постерами на стенах. Подойди ближе — рассмотри картинку. Интерактивный 2D-raycasting эксперимент.",
  date: new Date("2026-05-09"),
  cover: "/lab/maze-explorer/images/cover.svg",
  type: "interactive" as const,
  category: "unsorted" as const,
  tags: ["game", "raycasting", "interactive", "wip"],
  hasProcess: false,
  pinned: false,
  draft: false,
};
