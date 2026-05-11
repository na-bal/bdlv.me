// Метаданные эксперимента. Подхватываются индексной страницей /lab/.
export const meta = {
  title: "BlackNote",
  description:
    "Чёрная страница на весь экран. Кликаешь — пишешь. Текст хранится в вашем браузере и переживает закрытие вкладки. Никакого облака.",
  date: new Date("2024-04-15"),
  cover: "/lab/blacknote/images/cover.svg",
  type: "interactive" as const,
  category: "unsorted" as const,
  tags: ["text", "private", "minimal"],
  hasProcess: false,
  pinned: false,
  draft: false,
};
