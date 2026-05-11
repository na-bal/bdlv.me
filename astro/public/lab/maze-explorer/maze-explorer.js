// Лабиринт — Doom-style raycasting с настоящими текстурами-постерами на стенах.
// JS-island: статический файл из public/, не проходит через бандлер Astro.
//
// Ключевая техника: для каждого луча мы определяем, в какую стену он попал
// и в какой её точке (wallX ∈ [0..1]). Если на этой стене висит постер
// (wallType ∈ posterTypes), берём из соответствующей картинки вертикальный
// столбец пикселей в позиции `Math.floor(wallX * texture.width)` и рисуем
// его на canvas через ctx.drawImage с шириной 1px и нужной высотой стены.
// Затемнение по дистанции — поверх полупрозрачным чёрным.

(function () {
  // Все баннеры, развешанные по лабиринту. Каждой постерной клетке (тип > 1)
  // достанется один из них через детерминированный хеш по (mapX, mapY) —
  // одна и та же клетка всегда показывает одну и ту же картинку, но соседние
  // стены чередуются.
  const BANNERS = [
    "/lab/maze-explorer/banners/323.png",
    "/lab/maze-explorer/banners/Risunok11.jpg",
    "/lab/maze-explorer/banners/og_og_167752383028054114.jpg",
    "/lab/maze-explorer/banners/download.jpg",
    "/lab/maze-explorer/banners/images.jpg",
    "/lab/maze-explorer/banners/new_1.jpg",
    "/lab/maze-explorer/banners/new_2.jpg",
    "/lab/maze-explorer/banners/new_3.jpg",
    "/lab/maze-explorer/banners/new_4.jpg",
    "/lab/maze-explorer/banners/new_5.jpg",
    "/lab/maze-explorer/banners/new_6.jpg",
    "/lab/maze-explorer/banners/new_7.jpg",
    "/lab/maze-explorer/banners/new_8.jpg",
  ];

  // Цвета для не-постерных стен (граница лабиринта).
  const WALL_COLORS = {
    1: "#3a2418", // тёмный шоколад — внешние стены
  };
  const FALLBACK_WALL_COLOR = "#444";

  function bannerForCell(mapX, mapY) {
    // Простой хеш — стабильный, разводит соседние клетки по разным баннерам.
    const h = ((mapX * 73856093) ^ (mapY * 19349663)) >>> 0;
    return BANNERS[h % BANNERS.length];
  }

  class MazeExplorer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");

      this.map = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 2, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 1, 1, 1, 0, 0, 3, 0, 0, 0, 0, 0, 1],
        [1, 0, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 4, 0, 0, 1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 1],
        [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1],
        [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1],
        [1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ];
      this.mapWidth = this.map[0].length;
      this.mapHeight = this.map.length;

      this.player = {
        x: 1.5,
        y: 1.5,
        dir: 0,
        fov: Math.PI / 3,
        speed: 0.05,
        rotSpeed: 0.03,
      };
      this.maxDepth = 20;

      // Загружаем все баннеры один раз — один Image на каждый уникальный URL.
      // Клетки лабиринта затем берут текстуру через `bannerForCell` → URL → entry.
      this.textures = {};
      for (const src of BANNERS) {
        const img = new Image();
        img.src = src;
        const entry = { img, ready: false };
        img.onload = () => {
          entry.ready = true;
        };
        img.onerror = () => {
          console.warn("[maze] failed to load texture:", src);
        };
        this.textures[src] = entry;
      }

      this.keys = {};
      this.fitToContainer();
      this.setupControls();

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.gameLoop(t));

      window.addEventListener("resize", () => this.fitToContainer());
    }

    fitToContainer() {
      const rect = this.canvas.getBoundingClientRect();
      // Один луч на CSS-пиксель ширины — норма для 16x16 карты.
      this.width = Math.max(1, Math.floor(rect.width));
      this.height = Math.max(1, Math.floor(rect.height));
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.numRays = this.width;
    }

    setupControls() {
      window.addEventListener("keydown", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          this.keys[e.key] = true;
          e.preventDefault();
        }
      });
      window.addEventListener("keyup", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          this.keys[e.key] = false;
        }
      });

      const dpadButtons = document.querySelectorAll(".dpad-btn");
      dpadButtons.forEach((button) => {
        const key = button.getAttribute("data-key");
        const press = (e) => {
          e.preventDefault();
          this.keys[key] = true;
        };
        const release = (e) => {
          if (e) e.preventDefault();
          this.keys[key] = false;
        };
        button.addEventListener("touchstart", press, { passive: false });
        button.addEventListener("touchend", release, { passive: false });
        button.addEventListener("touchcancel", release, { passive: false });
        button.addEventListener("mousedown", press);
        button.addEventListener("mouseup", release);
        button.addEventListener("mouseleave", release);
      });

      // Не давать стрелкам скроллить страницу при тачах по canvas.
      const stop = (e) => e.preventDefault();
      this.canvas.addEventListener("touchstart", stop, { passive: false });
      this.canvas.addEventListener("touchmove", stop, { passive: false });
      this.canvas.addEventListener("touchend", stop, { passive: false });
    }

    isWall(x, y) {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      if (mapX < 0 || mapX >= this.mapWidth || mapY < 0 || mapY >= this.mapHeight) return true;
      return this.map[mapY][mapX] !== 0;
    }

    updatePlayer(deltaTime) {
      const moveSpeed = this.player.speed * deltaTime;
      const rotSpeed = this.player.rotSpeed * deltaTime;

      if (this.keys["ArrowLeft"]) this.player.dir -= rotSpeed;
      if (this.keys["ArrowRight"]) this.player.dir += rotSpeed;

      let newX = this.player.x;
      let newY = this.player.y;
      if (this.keys["ArrowUp"]) {
        newX += Math.cos(this.player.dir) * moveSpeed;
        newY += Math.sin(this.player.dir) * moveSpeed;
      }
      if (this.keys["ArrowDown"]) {
        newX -= Math.cos(this.player.dir) * moveSpeed;
        newY -= Math.sin(this.player.dir) * moveSpeed;
      }

      // Слайд по стенам — раздельные оси.
      if (!this.isWall(newX, this.player.y)) this.player.x = newX;
      if (!this.isWall(this.player.x, newY)) this.player.y = newY;
    }

    castRay(angle) {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      let distance = 0;
      let wallType = 0;
      let hitSide = 0;
      let wallX = 0;
      let mapX = -1;
      let mapY = -1;

      while (distance < this.maxDepth) {
        distance += 0.01;
        const testX = this.player.x + cos * distance;
        const testY = this.player.y + sin * distance;
        const mx = Math.floor(testX);
        const my = Math.floor(testY);

        if (mx < 0 || mx >= this.mapWidth || my < 0 || my >= this.mapHeight) {
          wallType = 1;
          distance = this.maxDepth;
          break;
        }
        if (this.map[my][mx] !== 0) {
          wallType = this.map[my][mx];
          mapX = mx;
          mapY = my;
          const blockX = testX - mx;
          const blockY = testY - my;
          // Какая сторона клетки задета — определяет, что брать в качестве wallX.
          if (blockX < 0.02 || blockX > 0.98) {
            hitSide = 0; // вертикальная грань — берём blockY
            wallX = blockY;
          } else {
            hitSide = 1; // горизонтальная грань — берём blockX
            wallX = blockX;
          }
          break;
        }
      }
      return { distance, wallType, hitSide, wallX, mapX, mapY };
    }

    drawWallSlice(x, ray) {
      const correctedDistance = ray.distance * Math.cos(this.rayAngleAtX(x) - this.player.dir);
      const wallHeight = (this.height / Math.max(0.0001, correctedDistance)) * 0.8;
      const wallTop = (this.height - wallHeight) / 2;
      // Затемнение по расстоянию (и чуть сильнее для горизонтальных граней).
      let brightness = Math.max(0.15, 1 - correctedDistance / this.maxDepth);
      if (ray.hitSide === 1) brightness *= 0.75;

      // Тип > 1 (постерная стена): тянем баннер по клетке. Тип 1 (граница) — цвет.
      const bannerSrc = ray.wallType > 1 && ray.mapX >= 0 ? bannerForCell(ray.mapX, ray.mapY) : null;
      const tex = bannerSrc ? this.textures[bannerSrc] : null;
      if (tex && tex.ready) {
        // Текстура постера: вырезаем 1px-широкий вертикальный столбец и масштабируем по высоте стены.
        const srcX = Math.min(tex.img.width - 1, Math.max(0, Math.floor(ray.wallX * tex.img.width)));
        try {
          this.ctx.drawImage(
            tex.img,
            srcX,
            0,
            1,
            tex.img.height,
            x,
            wallTop,
            1,
            wallHeight,
          );
        } catch {
          // На всякий случай — если drawImage не успел из-за гонки, рисуем плашку.
          this.ctx.fillStyle = FALLBACK_WALL_COLOR;
          this.ctx.fillRect(x, wallTop, 1, wallHeight);
        }
        // Затемнение поверх — полупрозрачным чёрным.
        if (brightness < 1) {
          this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
          this.ctx.fillRect(x, wallTop, 1, wallHeight);
        }
      } else {
        // Не-постерная стена или текстура ещё не загружена — рисуем цветом.
        const baseColor = WALL_COLORS[ray.wallType] || FALLBACK_WALL_COLOR;
        this.ctx.fillStyle = shadeColor(baseColor, brightness);
        this.ctx.fillRect(x, wallTop, 1, wallHeight);
      }
    }

    rayAngleAtX(x) {
      return this.player.dir - this.player.fov / 2 + (this.player.fov / this.numRays) * x;
    }

    render() {
      // Потолок и пол — два прямоугольника. Сначала, чтобы стены легли поверх.
      this.ctx.fillStyle = "#1a1a2e";
      this.ctx.fillRect(0, 0, this.width, this.height / 2);
      this.ctx.fillStyle = "#16213e";
      this.ctx.fillRect(0, this.height / 2, this.width, this.height / 2);

      for (let i = 0; i < this.numRays; i++) {
        const ray = this.castRay(this.rayAngleAtX(i));
        this.drawWallSlice(i, ray);
      }

      this.drawMinimap();
    }

    drawMinimap() {
      const size = 130;
      const pad = 16;
      const mx = this.width - size - pad;
      const my = pad;
      const cell = size / Math.max(this.mapWidth, this.mapHeight);

      this.ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      this.ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);

      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const t = this.map[y][x];
          if (t === 0) continue;
          // Минимапа: типы стен подсвечиваются разно — постерные ярче.
          this.ctx.fillStyle = t === 1 ? "rgba(255,255,255,0.35)" : "rgba(255,200,120,0.85)";
          this.ctx.fillRect(mx + x * cell, my + y * cell, cell - 1, cell - 1);
        }
      }

      // Игрок.
      const px = mx + this.player.x * cell;
      const py = my + this.player.y * cell;
      this.ctx.fillStyle = "#7ee787";
      this.ctx.beginPath();
      this.ctx.arc(px, py, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#7ee787";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(px, py);
      this.ctx.lineTo(px + Math.cos(this.player.dir) * 10, py + Math.sin(this.player.dir) * 10);
      this.ctx.stroke();
    }

    gameLoop(currentTime) {
      const deltaTime = (currentTime - this.lastTime) / 16.67;
      this.lastTime = currentTime;
      this.updatePlayer(deltaTime);
      this.render();
      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  function shadeColor(color, factor) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  }

  function start() {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;
    new MazeExplorer(canvas);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
