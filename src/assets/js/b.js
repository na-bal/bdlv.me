
// Загрузка и сохранение заметок в локальное хранилище
const board = document.querySelector('.black-note');
    // Загрузка
    document.addEventListener('DOMContentLoaded', () => {
      const saved = localStorage.getItem('BlackNoteContent');
      if (saved !== null) board.innerHTML = saved;
    });
    // Сохранение
    board.addEventListener('input', () => {
      localStorage.setItem('BlackNoteContent', board.innerHTML);
    });


// Появление плейсхоледа
const main = document.querySelector('main.black-note');

function updatePlaceholderClass() {
  const hasText = main.textContent.trim().length > 0;
  main.classList.toggle('has-content', hasText);
}

main.addEventListener('input',   updatePlaceholderClass);
main.addEventListener('focus',   updatePlaceholderClass);
main.addEventListener('blur',    updatePlaceholderClass);
document.addEventListener('DOMContentLoaded', updatePlaceholderClass);