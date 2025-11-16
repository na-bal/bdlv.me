// Maze Explorer - Doom-style raycasting game
class MazeExplorer {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Map configuration (1 = wall, 0 = empty, 2-9 = different wall types/posters)
        this.map = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,2,0,0,0,3,0,0,0,4,0,0,2,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,1,0,0,3,0,0,0,0,0,1],
            [1,0,3,0,1,0,0,0,0,0,0,0,0,3,0,1],
            [1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,1],
            [1,0,0,0,0,0,4,0,0,1,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,4,0,0,0,0,0,0,0,0,0,0,4,0,1],
            [1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
            [1,0,2,0,0,0,0,0,0,0,0,0,0,2,0,1],
            [1,0,0,0,0,0,3,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];

        this.mapWidth = this.map[0].length;
        this.mapHeight = this.map.length;
        this.tileSize = 64;

        // Player configuration
        this.player = {
            x: 1.5,  // Grid position
            y: 1.5,
            dir: 0,  // Direction in radians (0 = right, PI/2 = down)
            fov: Math.PI / 3,  // Field of view (60 degrees)
            speed: 0.05,
            rotSpeed: 0.03
        };

        // Ray casting configuration
        this.numRays = this.width;
        this.maxDepth = 20;

        // Colors for different wall types
        this.wallColors = {
            1: '#8B4513',  // Brown
            2: '#FF6B6B',  // Red (poster wall)
            3: '#4ECDC4',  // Cyan (poster wall)
            4: '#FFE66D'   // Yellow (poster wall)
        };

        // Textures/Posters content
        this.posters = {
            2: { title: 'BDLV.ME', subtitle: 'Portfolio & Projects', color: '#FF6B6B' },
            3: { title: 'Design', subtitle: 'Creative Solutions', color: '#4ECDC4' },
            4: { title: 'Code', subtitle: 'Interactive Experiences', color: '#FFE66D' }
        };

        // Controls
        this.keys = {};
        this.setupControls();

        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    setupControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            // Prevent arrow keys from scrolling
            if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.numRays = this.width;
    }

    updatePlayer(deltaTime) {
        const moveSpeed = this.player.speed * deltaTime;
        const rotSpeed = this.player.rotSpeed * deltaTime;

        // Rotation
        if (this.keys['ArrowLeft']) {
            this.player.dir -= rotSpeed;
        }
        if (this.keys['ArrowRight']) {
            this.player.dir += rotSpeed;
        }

        // Movement
        let newX = this.player.x;
        let newY = this.player.y;

        if (this.keys['ArrowUp']) {
            newX += Math.cos(this.player.dir) * moveSpeed;
            newY += Math.sin(this.player.dir) * moveSpeed;
        }
        if (this.keys['ArrowDown']) {
            newX -= Math.cos(this.player.dir) * moveSpeed;
            newY -= Math.sin(this.player.dir) * moveSpeed;
        }

        // Collision detection
        if (!this.isWall(newX, this.player.y)) {
            this.player.x = newX;
        }
        if (!this.isWall(this.player.x, newY)) {
            this.player.y = newY;
        }
    }

    isWall(x, y) {
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);

        if (mapX < 0 || mapX >= this.mapWidth || mapY < 0 || mapY >= this.mapHeight) {
            return true;
        }

        return this.map[mapY][mapX] !== 0;
    }

    castRay(angle) {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        let distance = 0;
        let hitWall = false;
        let wallType = 0;
        let hitSide = 0; // 0 = vertical, 1 = horizontal
        let wallX = 0; // Where exactly the wall was hit

        while (!hitWall && distance < this.maxDepth) {
            distance += 0.01;

            const testX = this.player.x + cos * distance;
            const testY = this.player.y + sin * distance;

            const mapX = Math.floor(testX);
            const mapY = Math.floor(testY);

            if (mapX < 0 || mapX >= this.mapWidth || mapY < 0 || mapY >= this.mapHeight) {
                hitWall = true;
                wallType = 1;
                distance = this.maxDepth;
            } else if (this.map[mapY][mapX] !== 0) {
                hitWall = true;
                wallType = this.map[mapY][mapX];

                // Determine which side of the wall was hit
                const blockX = testX - mapX;
                const blockY = testY - mapY;

                if (blockX < 0.02 || blockX > 0.98) {
                    hitSide = 0; // Vertical wall
                    wallX = blockY;
                } else {
                    hitSide = 1; // Horizontal wall
                    wallX = blockX;
                }
            }
        }

        return { distance, wallType, hitSide, wallX };
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw ceiling
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height / 2);

        // Draw floor
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, this.height / 2, this.width, this.height / 2);

        // Cast rays and render walls
        const rayAngleStep = this.player.fov / this.numRays;

        for (let i = 0; i < this.numRays; i++) {
            const rayAngle = this.player.dir - this.player.fov / 2 + rayAngleStep * i;
            const ray = this.castRay(rayAngle);

            // Fix fisheye effect
            const correctedDistance = ray.distance * Math.cos(rayAngle - this.player.dir);

            // Calculate wall height
            const wallHeight = (this.height / correctedDistance) * 0.5;
            const wallTop = (this.height - wallHeight) / 2;
            const wallBottom = wallTop + wallHeight;

            // Get wall color
            let baseColor = this.wallColors[ray.wallType] || '#666';

            // Apply shading based on distance and side
            const brightness = Math.max(0.2, 1 - (correctedDistance / this.maxDepth));
            const shadeFactor = ray.hitSide === 0 ? brightness : brightness * 0.7;

            const color = this.shadeColor(baseColor, shadeFactor);

            // Draw wall slice
            this.ctx.fillStyle = color;
            this.ctx.fillRect(i, wallTop, 1, wallHeight);

            // Draw poster content if close enough and it's a poster wall
            if (ray.wallType > 1 && correctedDistance < 3 && this.posters[ray.wallType]) {
                this.drawPoster(i, wallTop, wallHeight, ray.wallType, ray.wallX, correctedDistance);
            }
        }

        // Draw minimap
        this.drawMinimap();
    }

    drawPoster(x, wallTop, wallHeight, wallType, wallX, distance) {
        const poster = this.posters[wallType];

        // Only draw poster in the middle section of the wall
        const posterStart = 0.2;
        const posterEnd = 0.8;

        if (wallX > posterStart && wallX < posterEnd) {
            // Calculate poster position within the wall slice
            const posterProgress = (wallX - posterStart) / (posterEnd - posterStart);

            // Draw a vertical line of the poster
            const brightness = Math.max(0.4, 1 - (distance / 3));

            // Create gradient for poster
            const gradient = this.ctx.createLinearGradient(0, wallTop, 0, wallTop + wallHeight);
            gradient.addColorStop(0, this.shadeColor(poster.color, brightness * 0.5));
            gradient.addColorStop(0.5, this.shadeColor(poster.color, brightness));
            gradient.addColorStop(1, this.shadeColor(poster.color, brightness * 0.5));

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, wallTop + wallHeight * 0.2, 1, wallHeight * 0.6);
        }
    }

    shadeColor(color, factor) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        const newR = Math.floor(r * factor);
        const newG = Math.floor(g * factor);
        const newB = Math.floor(b * factor);

        return `rgb(${newR}, ${newG}, ${newB})`;
    }

    drawMinimap() {
        const minimapSize = 150;
        const minimapX = this.width - minimapSize - 20;
        const minimapY = 20;
        const cellSize = minimapSize / Math.max(this.mapWidth, this.mapHeight);

        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(minimapX - 5, minimapY - 5, minimapSize + 10, minimapSize + 10);

        // Draw map
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this.map[y][x] !== 0) {
                    const wallType = this.map[y][x];
                    this.ctx.fillStyle = this.wallColors[wallType] || '#666';
                    this.ctx.fillRect(
                        minimapX + x * cellSize,
                        minimapY + y * cellSize,
                        cellSize - 1,
                        cellSize - 1
                    );
                }
            }
        }

        // Draw player
        const playerX = minimapX + this.player.x * cellSize;
        const playerY = minimapY + this.player.y * cellSize;

        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw direction
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playerX, playerY);
        this.ctx.lineTo(
            playerX + Math.cos(this.player.dir) * 10,
            playerY + Math.sin(this.player.dir) * 10
        );
        this.ctx.stroke();
    }

    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 16.67; // Normalize to 60 FPS
        this.lastTime = currentTime;

        this.updatePlayer(deltaTime);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new MazeExplorer();
});
