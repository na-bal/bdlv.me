/* /mealprep — поведение «бланка»: галочки с памятью, печать, экспорт в Notion.
   Подключается одним <script src="…/mealprep.js" defer></script>.
   Хоткеи: P — печать · N — копировать в Notion (Markdown) · H — скрыть отмеченное. */
(function () {
  'use strict';

  // ключ хранилища = путь страницы (у каждой страницы своя память галочек)
  var STORE = 'mealprep:' + location.pathname.split('/').pop();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch (e) { return {}; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
  }

  // — Галочки: восстановить, навесить клики —
  function initChecklists() {
    var state = loadState();
    var items = document.querySelectorAll('.checklist li:not(.group)');
    items.forEach(function (li, i) {
      var key = li.getAttribute('data-key') || ('i' + i);
      li.setAttribute('data-key', key);
      li.setAttribute('role', 'checkbox');
      li.setAttribute('tabindex', '0');
      function toggle() {
        li.classList.toggle('is-done');
        var done = li.classList.contains('is-done');
        li.setAttribute('aria-checked', done ? 'true' : 'false');
        var s = loadState();
        s[key] = done;
        saveState(s);
      }
      if (state[key]) li.classList.add('is-done');
      li.setAttribute('aria-checked', li.classList.contains('is-done') ? 'true' : 'false');
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  // — Тост —
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  // — Сериализация страницы в Markdown (для вставки в Notion) —
  function toMarkdown() {
    var out = [];
    var sheet = document.querySelector('.sheet') || document.body;

    var title = sheet.querySelector('.title');
    if (title) out.push('# ' + clean(title.textContent));

    sheet.querySelectorAll('.meta .cell').forEach(function (c) {
      var k = c.querySelector('.k'), v = c.querySelector('.v');
      if (k && v) out.push('**' + clean(k.textContent) + ':** ' + clean(v.textContent));
    });
    if (out.length > 1) out.push('');

    // вводные врезки верхнего уровня (.lead между шапкой и секциями)
    sheet.querySelectorAll(':scope > .lead').forEach(function (l) { pushLead(out, l); });

    // идём по секциям по порядку
    sheet.querySelectorAll('.section').forEach(function (sec) {
      var lbl = sec.querySelector('.section__label');
      if (lbl) out.push('## ' + clean(lbl.firstChild ? lbl.firstChild.textContent : lbl.textContent));

      // вводные/текстовые блоки внутри секции
      sec.querySelectorAll('.lead').forEach(function (l) { pushLead(out, l); });
      sec.querySelectorAll('.prose').forEach(function (pr) {
        pr.querySelectorAll('p').forEach(function (p) {
          var why = p.querySelector('.why');
          if (why) out.push('**' + clean(why.textContent) + '** ' + clean(p.textContent).replace(clean(why.textContent), '').trim());
          else out.push(clean(p.textContent));
        });
      });

      // чек-листы
      sec.querySelectorAll('.checklist').forEach(function (ul) {
        ul.querySelectorAll('li').forEach(function (li) {
          if (li.classList.contains('group')) { out.push('', '**' + clean(li.textContent) + '**'); return; }
          var done = li.classList.contains('is-done') ? 'x' : ' ';
          var txt = li.querySelector('.txt') ? li.querySelector('.txt').textContent : li.textContent;
          var qty = li.querySelector('.qty');
          out.push('- [' + done + '] ' + clean(txt) + (qty ? ' — ' + clean(qty.textContent) : ''));
        });
      });

      // карточки
      sec.querySelectorAll('.card').forEach(function (card) {
        var t = card.querySelector('.card__title');
        if (t) out.push('', '### ' + clean(t.textContent));
        card.querySelectorAll('.card__row').forEach(function (r) {
          var k = r.querySelector('.rk'), v = r.querySelector('.rv');
          if (k && v) out.push('- **' + clean(k.textContent) + ':** ' + clean(v.textContent));
        });
        var tags = card.querySelectorAll('.tag');
        if (tags.length) out.push('- `' + Array.prototype.map.call(tags, function (x) { return clean(x.textContent); }).join('` `') + '`');
      });

      // матрица → markdown-таблица
      sec.querySelectorAll('.matrix').forEach(function (tbl) {
        var rows = tbl.querySelectorAll('tr');
        rows.forEach(function (tr, ri) {
          var cells = tr.querySelectorAll('th,td');
          var line = '| ' + Array.prototype.map.call(cells, function (c) { return clean(c.textContent); }).join(' | ') + ' |';
          out.push(line);
          if (ri === 0) out.push('|' + Array.prototype.map.call(cells, function () { return ' --- '; }).join('|') + '|');
        });
      });
      out.push('');
    });

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  // врезка .lead → строки markdown (заголовок-кикер жирным + абзацы)
  function pushLead(out, lead) {
    var k = lead.querySelector('.lead__k');
    if (k) out.push('**' + clean(k.textContent) + '**');
    lead.querySelectorAll('p').forEach(function (p) { out.push('> ' + clean(p.textContent)); });
    out.push('');
  }

  function copyMarkdown() {
    var md = toMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(
        function () { toast('Markdown скопирован → вставь в Notion'); },
        function () { fallbackCopy(md); }
      );
    } else { fallbackCopy(md); }
  }
  function fallbackCopy(md) {
    var ta = document.createElement('textarea');
    ta.value = md; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Markdown скопирован → вставь в Notion'); }
    catch (e) { toast('Не удалось скопировать'); }
    document.body.removeChild(ta);
  }

  // — Хоткеи + кнопки —
  function initActions() {
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'p') { e.preventDefault(); window.print(); }
      else if (k === 'n') { e.preventDefault(); copyMarkdown(); }
      else if (k === 'h') { e.preventDefault(); document.body.classList.toggle('hide-done'); }
    });
    var bp = document.querySelector('[data-act="print"]');
    var bn = document.querySelector('[data-act="notion"]');
    var bh = document.querySelector('[data-act="hide"]');
    if (bp) bp.addEventListener('click', function () { window.print(); });
    if (bn) bn.addEventListener('click', copyMarkdown);
    if (bh) bh.addEventListener('click', function () { document.body.classList.toggle('hide-done'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initChecklists();
    initActions();
  });
})();
