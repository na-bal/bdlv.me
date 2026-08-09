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

  // Отдельная память разморозки: ключ общий для всех страниц недели, потому что
  // отмечают её в сборке, а спрашивает о ней ловушка на следующий день.
  var THAW = 'mealprep:thaw';
  function loadThaw() {
    try { return JSON.parse(localStorage.getItem(THAW) || '{}'); }
    catch (e) { return {}; }
  }
  function saveThaw(s) {
    try { localStorage.setItem(THAW, JSON.stringify(s)); } catch (e) {}
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
        // Галочка «достать на завтра» пишет в общую память разморозки —
        // без этого ловушка initThawGuard никогда не замолкает и горит
        // каждый морозильный день.
        var day = li.getAttribute('data-thaw-day');
        if (day !== null) {
          var t = loadThaw();
          t[day] = done;
          saveThaw(t);
        }
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
  function bindAll(act, fn) {
    document.querySelectorAll('[data-act="' + act + '"]').forEach(function (b) {
      b.addEventListener('click', fn);
    });
  }
  function markAll(act, on) {
    document.querySelectorAll('[data-act="' + act + '"]').forEach(function (b) {
      b.classList.toggle('is-on', on);
    });
  }

  function initActions() {
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'p') { e.preventDefault(); window.print(); }
      else if (k === 'n') { e.preventDefault(); copyMarkdown(); }
      else if (k === 'h') { e.preventDefault(); document.body.classList.toggle('hide-done'); }
    });
    // Один и тот же data-act встречается дважды: в ряду .controls рядом со
    // списком и в десктопной панели .actions. Вешаем на все, иначе на одной
    // из них кнопка молча мертва.
    bindAll('print', function () { window.print(); });
    bindAll('notion', copyMarkdown);
    bindAll('hide', function () {
      var on = document.body.classList.toggle('hide-done');
      markAll('hide', on);
    });
  }

  // — Раннбук: где я и сколько прошёл —
  // Блок берём у ближайшего .group сверху от первого неотмеченного шага.
  function initRunbar() {
    var bar = document.querySelector('.runbar');
    if (!bar) return;
    var nameEl = bar.querySelector('.runbar__name');
    var blockEl = bar.querySelector('.runbar__block');
    var countEl = bar.querySelector('.runbar__count');
    var fill = bar.querySelector('.runbar__bar span');

    var groups = [];
    document.querySelectorAll('.checklist .group:not(.group--pause):not(.intro)').forEach(function (g) {
      groups.push(g);
    });

    function update() {
      var items = document.querySelectorAll('.checklist li:not(.group)');
      var total = items.length, done = 0, first = null;
      items.forEach(function (li) {
        if (li.classList.contains('is-done')) done++;
        else if (!first) first = li;
      });

      if (countEl) countEl.innerHTML = done + '<i>/' + total + '</i>';
      if (fill) fill.style.width = total ? Math.round((done / total) * 100) + '%' : '0%';

      var cur = null, idx = -1;
      if (first) {
        for (var i = 0; i < groups.length; i++) {
          if (groups[i].compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) {
            cur = groups[i]; idx = i;
          }
        }
      }
      if (nameEl) nameEl.textContent = cur ? cur.textContent.replace(/\s+/g, ' ').trim() : 'Готово';
      if (blockEl && groups.length) {
        blockEl.textContent = cur
          ? 'Блок ' + (idx + 1) + ' из ' + groups.length
          : 'Все блоки пройдены';
      }
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('.checklist li')) setTimeout(update, 0);
    });
    update();
  }

  // — Где я остановился —
  // Галочки хранились, место в списке — нет. scrollIntoView не используем:
  // считаем offsetTop вручную, иначе липкая шапка перекрывает цель.
  function initResume() {
    var list = document.querySelector('.checklist');
    if (!list) return;

    var items = document.querySelectorAll('.checklist li:not(.group), .checklist li.group--pause');
    var target = null;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].classList.contains('is-done')) { target = items[i]; break; }
    }
    if (!target) return;
    if (!document.querySelectorAll('.checklist li.is-done').length) return; // ничего не начато

    // В подпись идёт только сам шаг: подпись типа, плашка готовности,
    // свёрнутое «почему» и кнопка таймера в неё не лезут.
    var src = target.querySelector('.txt') || target;
    var clone = src.cloneNode(true);
    clone.querySelectorAll('.kind,.ready,.why-in,.timer-start,.num').forEach(function (n) {
      n.remove();
    });
    var label = clone.textContent.replace(/\s+/g, ' ').trim();

    var bar = document.createElement('button');
    bar.className = 'resume';
    bar.innerHTML = '<span style="font-family:var(--mono);font-size:22px;line-height:1">↳</span>' +
      '<span style="flex:1;min-width:0"><span class="resume__k">Ты остановился здесь</span>' +
      '<span class="resume__v"></span></span>';
    bar.querySelector('.resume__v').textContent = label.slice(0, 44) + (label.length > 44 ? '…' : '');

    bar.addEventListener('click', function () {
      var y = 0, el = target;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      window.scrollTo({ top: y - 90, behavior: 'smooth' });
    });

    // Полоса встаёт прямо над рядом контролов, а если его нет — сразу под шапкой
    var anchor = document.querySelector('.controls');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(bar, anchor);
      return;
    }
    var head = document.querySelector('.blank__head');
    if (head && head.parentNode) head.parentNode.insertBefore(bar, head.nextSibling);
  }

  // — Таймеры: стопка, а не один —
  // Разметка шага: <li data-timer="20:00" data-tname="Духовка · поменять противни">
  function initTimers() {
    var bar = document.querySelector('.runbar');
    if (!bar) return;

    var tray = document.createElement('div');
    bar.appendChild(tray);

    var timers = [], tick = null, ac = null;

    function mmss(s) {
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function alarm() {
      try { if (navigator.vibrate) navigator.vibrate([400, 180, 400, 180, 700]); } catch (e) {}
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = ac || new AC();
        if (ac.state === 'suspended') ac.resume();
        [0, 0.45, 0.9].forEach(function (off) {
          var o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + off;
          o.type = 'square'; o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
          o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.32);
        });
      } catch (e) {}
    }

    function render() {
      tray.innerHTML = '';
      timers.forEach(function (t) {
        var row = document.createElement('div');
        row.className = 'tmr' + (t.left === 0 ? ' is-fired' : '');
        row.innerHTML = '<span class="tmr__label"></span>' +
          '<button data-a="-">−</button><b class="tmr__time"></b>' +
          '<button data-a="+">+</button><button data-a="x">✕</button>';
        row.querySelector('.tmr__label').textContent = t.label;
        row.querySelector('.tmr__time').textContent = mmss(t.left);
        row.addEventListener('click', function (e) {
          var a = e.target.getAttribute('data-a');
          if (a === '-') t.left = Math.max(0, t.left - 60);
          else if (a === '+') t.left = t.left + 60;
          else if (a === 'x') timers = timers.filter(function (x) { return x !== t; });
          else return;
          if (!timers.length && tick) { clearInterval(tick); tick = null; }
          render();
        });
        tray.appendChild(row);
      });
    }

    function add(label, sec) {
      timers.push({ label: label, left: sec });
      if (!tick) tick = setInterval(function () {
        var fire = false;
        timers.forEach(function (t) {
          if (t.left <= 0) return;
          t.left -= 1;
          if (t.left === 0) fire = true;
        });
        if (fire) alarm();
        render();
      }, 1000);
      render();
    }

    document.querySelectorAll('.checklist li[data-timer]').forEach(function (li) {
      var btn = document.createElement('button');
      btn.className = 'timer-start';
      btn.textContent = '▶ Таймер ' + li.getAttribute('data-timer');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();                       // не отмечать шаг сделанным
        var parts = li.getAttribute('data-timer').split(':');
        add(li.getAttribute('data-tname') || 'Шаг', (+parts[0]) * 60 + (+(parts[1] || 0)));
      });
      var txt = li.querySelector('.txt');
      (txt || li).appendChild(btn);
    });
  }

  // — Сборка знает сегодня —
  // Карточка дня: <div class="card" data-day="4" data-date="2026-08-13"
  //                    data-frozen="1" data-thaw="индейка и рис на субботу">
  // data-day по Date.getDay(): вс=0 … сб=6.
  var DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда',
              'четверг', 'пятница', 'суббота'];

  function initToday() {
    var cards = document.querySelectorAll('.card[data-day]');
    if (!cards.length) return;

    var head = document.querySelector('.today');
    var kEl = head && head.querySelector('.today__k');
    var dEl = head && head.querySelector('.today__d');
    var today = new Date().getDay();

    // порядок листания — как лежат карточки в разметке, а не по номеру дня
    var order = Array.prototype.slice.call(cards);
    var pos = 0;
    order.forEach(function (c, i) {
      if (+c.getAttribute('data-day') === today) pos = i;
    });

    function show(i) {
      pos = (i + order.length) % order.length;
      order.forEach(function (c, j) {
        c.classList.toggle('is-other', j !== pos);
        c.classList.toggle('is-today', j === pos && +c.getAttribute('data-day') === today);
      });
      var c = order[pos];
      var isToday = +c.getAttribute('data-day') === today;
      var date = c.getAttribute('data-date') || '';
      var dm = date ? date.slice(8, 10) + '.' + date.slice(5, 7) : '';
      if (kEl) kEl.textContent = (isToday ? 'Сегодня' : 'День недели') + (dm ? ' · ' + dm : '');
      if (dEl) dEl.textContent = DAYS[+c.getAttribute('data-day')] || '';
      document.body.classList.toggle('not-today', !isToday);
    }

    if (head) {
      head.querySelectorAll('[data-day-nav]').forEach(function (b) {
        b.addEventListener('click', function () {
          show(pos + (+b.getAttribute('data-day-nav')));
        });
      });
    }
    show(pos);
  }

  // — Ловушка на забытую разморозку —
  // Врезка показывается ТОЛЬКО если вчерашняя галочка «достать» не отмечена.
  // Врезка, которая горит каждый морозильный день, будет отключена вниманием.
  function initThawGuard() {
    var todayCard = document.querySelector('.card[data-day].is-today');
    if (!todayCard || todayCard.getAttribute('data-frozen') !== '1') return;

    // От какого дня зависит сегодняшняя тарелка — сказано в разметке, а не
    // вычисляется как «вчера»: разморозка идёт не всегда накануне. В этой
    // неделе пн→ср и вт→чт — это два дня, и «вчера» промахнулось бы ровно
    // на четверге, первом морозильном дне.
    var from = todayCard.getAttribute('data-thaw-from');
    if (from === null) return;

    var prev = document.querySelector('.card[data-day="' + from + '"]');
    if (!prev) return;
    var task = prev.querySelector('[data-thaw-day]');
    if (!task) return;

    if (loadThaw()[from]) return;                  // отмечено — молчим

    var box = document.createElement('div');
    box.className = 'lead lead--warn thaw-guard';
    box.innerHTML = '<div class="lead__k">⚠ Похоже, забыл</div><p></p>';
    var what = task.querySelector('.txt') ? task.querySelector('.txt').textContent : '';
    what = what.replace('Достать заранее', '').replace(/\s+/g, ' ').trim();
    box.querySelector('p').textContent =
      'Не отмечено «' + what + '» (' + (DAYS[+from] || 'ранее') +
      '), а сегодня ты ешь размороженное. Проверь — если оно ещё каменное, ужин сдвинется на час.';
    todayCard.parentNode.insertBefore(box, todayCard);
  }

  // — Режим «один шаг» —
  // Паузы ОСТАЮТСЯ остановками последовательности и получают кнопку
  // «отдохнул, дальше»: пауза это смена режима, а не шаг.
  function initFocus() {
    function current() {
      document.querySelectorAll('.checklist li.is-current').forEach(function (li) {
        li.classList.remove('is-current');
      });
      var items = document.querySelectorAll('.checklist li:not(.group), .checklist li.group--pause');
      for (var i = 0; i < items.length; i++) {
        var li = items[i];
        if (li.classList.contains('is-done')) continue;
        li.classList.add('is-current');
        if (li.classList.contains('group--pause') && !li.querySelector('.pause-next')) {
          var b = document.createElement('button');
          b.className = 'pause-next';
          b.textContent = 'Отдохнул, дальше →';
          (function (node) {
            b.addEventListener('click', function () {
              node.classList.add('is-done');
              current();
            });
          })(li);
          li.appendChild(b);
        }
        return;
      }
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('.checklist li')) setTimeout(current, 0);
    });
    bindAll('focus', function () {
      markAll('focus', document.body.classList.toggle('focus-step'));
      current();
    });
    current();
  }

  // — Сроки: статус считается из даты, а не вписывается руками —
  // Список сортируется по сгоранию, просроченное уезжает наверх.
  function initBurn() {
    var rows = document.querySelectorAll('.burn__row[data-burn]');
    if (!rows.length) return;

    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var host = rows[0].parentNode;
    var list = Array.prototype.slice.call(host.children);

    list.forEach(function (row) {
      var d = row.getAttribute('data-burn');
      if (!d) { row._sort = Infinity; return; }
      var p = d.split('-');
      var due = new Date(+p[0], +p[1] - 1, +p[2]);
      var left = Math.round((due - today) / 86400000);
      row._sort = left;

      var s = document.createElement('span');
      s.className = 'burn__s';
      if (left < 0) {
        row.classList.add('is-over');
        s.textContent = 'просрочено';
      } else if (left === 0) {
        row.classList.add('is-last');
        s.textContent = 'сегодня последний';
      } else {
        s.textContent = 'осталось ' + left + ' дн';
      }
      row.appendChild(s);
    });

    list.sort(function (a, b) { return a._sort - b._sort; })
        .forEach(function (row) { host.appendChild(row); });
  }

  // — Кнопка «почему» —
  function initWhy() {
    bindAll('why', function () {
      markAll('why', document.body.classList.toggle('show-why'));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initChecklists();
    initActions();
    initRunbar();
    initResume();
    initTimers();
    initToday();
    initThawGuard();
    initBurn();
    initFocus();
    initWhy();
  });
})();
