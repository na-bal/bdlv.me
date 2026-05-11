// Метаданные эксперимента. Подхватываются индексной страницей /lab/.
export const meta = {
  title: "Комната с обоями",
  description:
    "Интерактивная 3D-комната, собранная в Spline. Прогуляйся внутри, посмотри как сочетаются обои.",
  date: new Date("2021-11-20"),
  cover: "/lab/wallpaper-room/images/cover.png",
  type: "interactive" as const,
  category: "unsorted" as const,
  tags: ["3d", "spline", "interactive"],
  hasProcess: false,
  pinned: false,
  draft: false,
};
