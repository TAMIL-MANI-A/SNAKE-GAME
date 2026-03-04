const CONFIG = Object.freeze({
  GRID: { SIZE: 20, PADDING: 40 },
  SNAKE: { INITIAL_LENGTH: 3, GROWTH_PER_FOOD: 1 },
  SPEED: {
    EASY: 120,
    NORMAL: 80,
    HARD: 50,
    INSANE: 30,
    SPEED_INCREASE_PER_LEVEL: 5,
    MIN_SPEED: 25
  },
  SCORING: {
    FOOD_BASE: 10,
    FOOD_MULTIPLIER: 1.5,
    LEVEL_BONUS: 100,
    SPECIAL_FOOD_MULTIPLIER: 5,
    SPEED_BONUS_MULTIPLIER: 2
  },
  LEVELS: { FOOD_PER_LEVEL: 5, MAX_LEVEL: 99 },
  FOOD: {
    NORMAL: { color: "#00ffff", points: 1, duration: null },
    BONUS: { color: "#ffff00", points: 3, duration: 5000 },
    SUPER: { color: "#ff00ff", points: 5, duration: 3000 },
    SPEED: { color: "#00ff00", points: 2, duration: 4000, effect: "slow" }
  },
  PARTICLES: {
    FOOD_COLLECT: 20,
    DEATH: 50,
    LEVEL_UP: 40,
    LIFETIME: 1000,
    MAX_COUNT: 300
  },
  STORAGE: {
    HIGH_SCORE: "snake_highScore",
    GAMES_PLAYED: "snake_gamesPlayed",
    SETTINGS: "snake_settings"
  },
  AUDIO: { ENABLED: true, VOLUME: 0.3 }
});

const Utils = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  random: (min, max) => Math.random() * (max - min) + min,
  randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  getElement: (id) => document.getElementById(id),
  toRgba(color, alpha = 1) {
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16),
        g = parseInt(color.slice(3, 5), 16),
        b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
  },
  storage: {
    get(key, def = null) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {}
    }
  },
  isMobile: () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth < 768
};

class AudioSystem {
  constructor() {
    this.enabled = CONFIG.AUDIO.ENABLED;
    this.volume = CONFIG.AUDIO.VOLUME;
    this.audioContext = null;
    this.initialized = false;
  }
  init() {
    if (this.initialized) return;
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.initialized = true;
    } catch {
      this.enabled = false;
    }
  }
  play(type) {
    if (!this.enabled || !this.audioContext) return;
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    const osc = this.audioContext.createOscillator(),
      gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    const now = this.audioContext.currentTime;
    switch (type) {
      case "eat":
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case "bonus":
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(784, now + 0.2);
        gain.gain.setValueAtTime(this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case "levelUp":
        osc.type = "square";
        osc.frequency.setValueAtTime(262, now);
        osc.frequency.setValueAtTime(330, now + 0.1);
        osc.frequency.setValueAtTime(392, now + 0.2);
        osc.frequency.setValueAtTime(523, now + 0.3);
        gain.gain.setValueAtTime(this.volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      case "death":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
    }
  }
}

class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.resize();
    this.handleResize = this.resize.bind(this);
    window.addEventListener("resize", this.handleResize);
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  emit(x, y, count, color, speed = 200) {
    const maxAdd = CONFIG.PARTICLES.MAX_COUNT - this.particles.length;
    const actualCount = Math.min(count, maxAdd);
    if (actualCount <= 0) return;
    for (let i = 0; i < actualCount; i++) {
      const angle = (Math.PI * 2 * i) / actualCount + Utils.random(-0.3, 0.3);
      const velocity = Utils.random(speed * 0.5, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: Utils.random(3, 8),
        color: color || `hsl(${Utils.randomInt(180, 220)}, 100%, 60%)`,
        life: CONFIG.PARTICLES.LIFETIME,
        maxLife: CONFIG.PARTICLES.LIFETIME,
        gravity: Utils.random(0, 100)
      });
    }
  }
  update(dt) {
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt + p.gravity * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt * 1000;
      return p.life > 0;
    });
  }
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach((p) => {
      const alpha = p.life / p.maxLife,
        size = p.size * alpha;
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }
  clear() {
    this.particles = [];
  }
  destroy() {
    window.removeEventListener("resize", this.handleResize);
    this.clear();
  }
}

class InputManager {
  constructor() {
    this.direction = "right";
    this.directionQueue = [];
    this.maxQueueSize = 2;
    this.enabled = true;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.minSwipeDistance = 30;
    this.bindMethods();
    this.attachListeners();
  }
  bindMethods() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }
  attachListeners() {
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("touchstart", this.handleTouchStart, {
      passive: false
    });
    document.addEventListener("touchend", this.handleTouchEnd, {
      passive: false
    });
  }
  handleKeyDown(e) {
    if (!this.enabled) return;
    const keyMap = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right"
    };
    const dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      this.queueDirection(dir);
    }
  }
  handleTouchStart(e) {
    if (!this.enabled) return;
    const t = e.touches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
  }
  handleTouchEnd(e) {
    if (!this.enabled) return;
    const t = e.changedTouches[0],
      dx = t.clientX - this.touchStartX,
      dy = t.clientY - this.touchStartY;
    if (
      Math.abs(dx) < this.minSwipeDistance &&
      Math.abs(dy) < this.minSwipeDistance
    )
      return;
    this.queueDirection(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
        ? "down"
        : "up"
    );
  }
  queueDirection(dir) {
    const lastDir =
      this.directionQueue.length > 0
        ? this.directionQueue[this.directionQueue.length - 1]
        : this.direction;
    const opposites = { up: "down", down: "up", left: "right", right: "left" };
    if (opposites[dir] === lastDir || dir === lastDir) return;
    if (this.directionQueue.length < this.maxQueueSize)
      this.directionQueue.push(dir);
  }
  getNextDirection() {
    if (this.directionQueue.length > 0)
      this.direction = this.directionQueue.shift();
    return this.direction;
  }
  setDirection(dir) {
    this.direction = dir;
    this.directionQueue = [];
  }
  reset() {
    this.direction = "right";
    this.directionQueue = [];
  }
  enable() {
    this.enabled = true;
  }
  disable() {
    this.enabled = false;
  }
  destroy() {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("touchstart", this.handleTouchStart);
    document.removeEventListener("touchend", this.handleTouchEnd);
  }
}
class SnakeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.baseSpeed = options.speed || CONFIG.SPEED.NORMAL;
    this.gameMode = options.mode || "classic";
    this.onScoreChange = options.onScoreChange || (() => {});
    this.onLevelUp = options.onLevelUp || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
    this.onFoodEaten = options.onFoodEaten || (() => {});
    this.input = new InputManager();
    this.audio = new AudioSystem();
    this.resize();
    this.init();
    this.handleResize = this.resize.bind(this);
    window.addEventListener("resize", this.handleResize);
  }
  resize() {
    const container = this.canvas.parentElement,
      padding = CONFIG.GRID.PADDING,
      size = CONFIG.GRID.SIZE;
    const dpr = window.devicePixelRatio || 1;
    const maxWidth =
      (container?.clientWidth || window.innerWidth) - padding * 2;
    const maxHeight =
      (container?.clientHeight || window.innerHeight) - padding * 2 - 100;
    this.cols = Math.max(15, Math.floor(maxWidth / size));
    this.rows = Math.max(10, Math.floor(maxHeight / size));
    const logicalWidth = this.cols * size,
      logicalHeight = this.rows * size;
    this.canvas.width = logicalWidth * dpr;
    this.canvas.height = logicalHeight * dpr;
    this.canvas.style.width = logicalWidth + "px";
    this.canvas.style.height = logicalHeight + "px";
    this.canvas.style.marginTop = `${padding + 60}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.gridSize = size;
    if (
      this.obstacles &&
      this.gameMode === "obstacles" &&
      this.state !== "playing"
    )
      this.generateObstacles();
  }
  init() {
    if (this.bonusFoodTimer) {
      clearTimeout(this.bonusFoodTimer);
      this.bonusFoodTimer = null;
    }
    this.state = "ready";
    this.score = 0;
    this.level = 1;
    this.foodEaten = 0;
    this.currentSpeed = this.baseSpeed;
    this.snake = [];
    this.growthPending = 0;
    this.food = null;
    this.bonusFood = null;
    this.obstacles = [];
    this.lastMoveTime = 0;
    this.moveAccumulator = 0;
    this.resetSnake();
    if (this.gameMode === "obstacles") this.generateObstacles();
    this.spawnFood();
    this.input.reset();
  }
  resetSnake() {
    this.snake = [];
    const startX = Math.floor(this.cols / 4),
      startY = Math.floor(this.rows / 2);
    for (let i = 0; i < CONFIG.SNAKE.INITIAL_LENGTH; i++)
      this.snake.push({ x: startX - i, y: startY });
    this.input.setDirection("right");
  }
  generateObstacles() {
    this.obstacles = [];
    const count = Math.min(5 + this.level * 2, 20);
    for (let i = 0; i < count; i++) {
      let pos,
        attempts = 0;
      do {
        pos = {
          x: Utils.randomInt(2, this.cols - 3),
          y: Utils.randomInt(2, this.rows - 3)
        };
        attempts++;
      } while (this.isPositionOccupied(pos) && attempts < 50);
      if (attempts < 50) this.obstacles.push(pos);
    }
  }
  isPositionOccupied(pos, excludeFood = false) {
    if (this.snake.some((seg) => seg.x === pos.x && seg.y === pos.y))
      return true;
    if (
      !excludeFood &&
      this.food &&
      this.food.x === pos.x &&
      this.food.y === pos.y
    )
      return true;
    if (this.obstacles.some((obs) => obs.x === pos.x && obs.y === pos.y))
      return true;
    const head = this.snake[0];
    if (head && Math.abs(pos.x - head.x) <= 3 && Math.abs(pos.y - head.y) <= 3)
      return true;
    return false;
  }
  spawnFood() {
    let pos,
      attempts = 0;
    do {
      pos = {
        x: Utils.randomInt(1, this.cols - 2),
        y: Utils.randomInt(1, this.rows - 2)
      };
      attempts++;
    } while (this.isPositionOccupied(pos) && attempts < 100);
    this.food = {
      ...pos,
      type: "NORMAL",
      color: CONFIG.FOOD.NORMAL.color,
      points: CONFIG.FOOD.NORMAL.points,
      pulse: 0
    };
    if (Math.random() < 0.1 && !this.bonusFood) this.spawnBonusFood();
  }
  spawnBonusFood() {
    const types = ["BONUS", "SUPER", "SPEED"],
      type = types[Utils.randomInt(0, types.length - 1)],
      foodConfig = CONFIG.FOOD[type];
    let pos,
      attempts = 0;
    do {
      pos = {
        x: Utils.randomInt(1, this.cols - 2),
        y: Utils.randomInt(1, this.rows - 2)
      };
      attempts++;
    } while (this.isPositionOccupied(pos) && attempts < 100);
    this.bonusFood = {
      ...pos,
      type,
      color: foodConfig.color,
      points: foodConfig.points,
      effect: foodConfig.effect,
      pulse: 0,
      timeLeft: foodConfig.duration
    };
    if (this.bonusFoodTimer) clearTimeout(this.bonusFoodTimer);
    this.bonusFoodTimer = setTimeout(() => {
      this.bonusFood = null;
    }, foodConfig.duration);
  }
  start() {
    this.state = "playing";
    this.lastMoveTime = performance.now();
    this.audio.init();
    this.loop();
  }
  pause() {
    if (this.state === "playing") this.state = "paused";
  }
  resume() {
    if (this.state === "paused") {
      this.state = "playing";
      this.lastMoveTime = performance.now();
      this.loop();
    }
  }
  togglePause() {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }
  update(currentTime) {
    if (this.state !== "playing") return;
    const deltaTime = currentTime - this.lastMoveTime;
    this.moveAccumulator += deltaTime;
    this.lastMoveTime = currentTime;
    if (this.food) this.food.pulse += deltaTime * 0.005;
    if (this.bonusFood) {
      this.bonusFood.pulse += deltaTime * 0.008;
      this.bonusFood.timeLeft -= deltaTime;
    }
    if (this.moveAccumulator >= this.currentSpeed) {
      this.moveAccumulator = 0;
      this.moveSnake();
    }
  }
  moveSnake() {
    const direction = this.input.getNextDirection();
    if (!direction) return;
    const head = { ...this.snake[0] };
    switch (direction) {
      case "up":
        head.y--;
        break;
      case "down":
        head.y++;
        break;
      case "left":
        head.x--;
        break;
      case "right":
        head.x++;
        break;
    }
    if (this.gameMode === "noWalls") {
      if (head.x < 0) head.x = this.cols - 1;
      if (head.x >= this.cols) head.x = 0;
      if (head.y < 0) head.y = this.rows - 1;
      if (head.y >= this.rows) head.y = 0;
    } else {
      if (
        head.x < 0 ||
        head.x >= this.cols ||
        head.y < 0 ||
        head.y >= this.rows
      ) {
        this.gameOver();
        return;
      }
    }
    const checkLength =
      this.growthPending > 0 ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < checkLength; i++)
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        this.gameOver();
        return;
      }
    if (this.obstacles.some((obs) => obs.x === head.x && obs.y === head.y)) {
      this.gameOver();
      return;
    }
    this.snake.unshift(head);
    let ate = false;
    if (this.food && head.x === this.food.x && head.y === this.food.y) {
      this.eatFood(this.food);
      this.spawnFood();
      ate = true;
    }
    if (
      this.bonusFood &&
      head.x === this.bonusFood.x &&
      head.y === this.bonusFood.y
    ) {
      this.eatFood(this.bonusFood, true);
      this.bonusFood = null;
      if (this.bonusFoodTimer) {
        clearTimeout(this.bonusFoodTimer);
        this.bonusFoodTimer = null;
      }
      ate = true;
    }
    if (this.growthPending > 0) this.growthPending--;
    else this.snake.pop();
  }
  eatFood(food, isBonus = false) {
    let points = food.points * CONFIG.SCORING.FOOD_BASE;
    points *= 1 + (this.level - 1) * 0.1;
    points = Math.floor(points);
    if (isBonus) {
      points *= CONFIG.SCORING.SPECIAL_FOOD_MULTIPLIER;
      this.audio.play("bonus");
    } else this.audio.play("eat");
    this.score += points;
    this.foodEaten++;
    this.growthPending += CONFIG.SNAKE.GROWTH_PER_FOOD * food.points;
    if (food.effect === "slow") {
      this.currentSpeed = Math.min(this.currentSpeed + 20, 150);
      setTimeout(() => {
        this.currentSpeed = this.calculateSpeed();
      }, 3000);
    }
    if (this.foodEaten >= CONFIG.LEVELS.FOOD_PER_LEVEL * this.level)
      this.levelUp();
    this.onScoreChange(this.score, this.snake.length);
    this.onFoodEaten(food, isBonus);
  }
  levelUp() {
    if (this.level >= CONFIG.LEVELS.MAX_LEVEL) return;
    this.level++;
    this.score += CONFIG.SCORING.LEVEL_BONUS * this.level;
    this.currentSpeed = this.calculateSpeed();
    if (this.gameMode === "obstacles") this.generateObstacles();
    this.audio.play("levelUp");
    this.onLevelUp(this.level);
  }
  calculateSpeed() {
    return Math.max(
      this.baseSpeed - (this.level - 1) * CONFIG.SPEED.SPEED_INCREASE_PER_LEVEL,
      CONFIG.SPEED.MIN_SPEED
    );
  }
  gameOver() {
    this.state = "gameOver";
    this.audio.play("death");
    if (this.bonusFoodTimer) clearTimeout(this.bonusFoodTimer);
    this.onGameOver({
      score: this.score,
      length: this.snake.length,
      level: this.level
    });
  }
  draw() {
    const ctx = this.ctx,
      size = this.gridSize;
    ctx.fillStyle = "rgba(5, 5, 15, 0.95)";
    ctx.fillRect(0, 0, this.cols * size, this.rows * size);
    this.drawGrid();
    this.drawObstacles();
    this.drawFood();
    this.drawSnake();
    if (this.gameMode === "classic" || this.gameMode === "obstacles")
      this.drawWalls();
  }
  drawGrid() {
    const ctx = this.ctx,
      size = this.gridSize;
    ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * size, 0);
      ctx.lineTo(x * size, this.rows * size);
      ctx.stroke();
    }
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * size);
      ctx.lineTo(this.cols * size, y * size);
      ctx.stroke();
    }
  }
  drawWalls() {
    const ctx = this.ctx,
      width = this.cols * this.gridSize,
      height = this.rows * this.gridSize;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#ff0066");
    gradient.addColorStop(0.5, "#ff00ff");
    gradient.addColorStop(1, "#ff0066");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff0066";
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
    ctx.shadowBlur = 0;
  }
  drawObstacles() {
    const ctx = this.ctx,
      size = this.gridSize;
    this.obstacles.forEach((obs) => {
      const x = obs.x * size,
        y = obs.y * size;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff4444";
      ctx.fillStyle = "#ff2222";
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      ctx.fillStyle = "#880000";
      ctx.fillRect(x + 5, y + 5, size - 10, size - 10);
      ctx.shadowBlur = 0;
    });
  }
  drawFood() {
    if (this.food) this.drawFoodItem(this.food);
    if (this.bonusFood) this.drawFoodItem(this.bonusFood, true);
  }
  drawFoodItem(food, isBonus = false) {
    const ctx = this.ctx,
      size = this.gridSize,
      x = food.x * size + size / 2,
      y = food.y * size + size / 2,
      pulse = Math.sin(food.pulse) * 3,
      radius = size / 2 - 4 + pulse;
    ctx.shadowBlur = 20 + pulse * 2;
    ctx.shadowColor = food.color;
    if (isBonus) {
      ctx.strokeStyle = food.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, food.color);
    gradient.addColorStop(1, Utils.toRgba(food.color, 0.5));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  drawSnake() {
    const ctx = this.ctx,
      size = this.gridSize;
    this.snake.forEach((segment, index) => {
      const x = segment.x * size,
        y = segment.y * size,
        isHead = index === 0;
      const hue = 120 + (index / this.snake.length) * 60,
        lightness = 60 - (index / this.snake.length) * 20;
      const color = `hsl(${hue}, 100%, ${lightness}%)`;
      ctx.shadowBlur = isHead ? 20 : 5;
      ctx.shadowColor = isHead ? "#00ff88" : color;
      const padding = isHead ? 1 : 2,
        segSize = size - padding * 2;
      if (isHead) {
        ctx.fillStyle = "#00ff88";
        this.drawRoundedRect(
          ctx,
          x + padding,
          y + padding,
          segSize,
          segSize,
          6
        );
        ctx.fill();
        const dir = this.input.direction || "right",
          eyeSize = 4,
          eyeOffset = 4;
        ctx.fillStyle = "#000";
        let eye1X, eye1Y, eye2X, eye2Y;
        switch (dir) {
          case "up":
            eye1X = x + size / 2 - eyeOffset;
            eye1Y = y + eyeOffset + 2;
            eye2X = x + size / 2 + eyeOffset;
            eye2Y = y + eyeOffset + 2;
            break;
          case "down":
            eye1X = x + size / 2 - eyeOffset;
            eye1Y = y + size - eyeOffset - 2;
            eye2X = x + size / 2 + eyeOffset;
            eye2Y = y + size - eyeOffset - 2;
            break;
          case "left":
            eye1X = x + eyeOffset + 2;
            eye1Y = y + size / 2 - eyeOffset;
            eye2X = x + eyeOffset + 2;
            eye2Y = y + size / 2 + eyeOffset;
            break;
          default:
            eye1X = x + size - eyeOffset - 2;
            eye1Y = y + size / 2 - eyeOffset;
            eye2X = x + size - eyeOffset - 2;
            eye2Y = y + size / 2 + eyeOffset;
        }
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = color;
        this.drawRoundedRect(
          ctx,
          x + padding,
          y + padding,
          segSize,
          segSize,
          4
        );
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    });
  }
  drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  loop() {
    if (this.state === "gameOver" || this.state === "paused") return;
    this.update(performance.now());
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
  getSnakeHeadPosition() {
    if (!this.snake.length) return null;
    const head = this.snake[0];
    return {
      x: head.x * this.gridSize + this.gridSize / 2 + this.canvas.offsetLeft,
      y: head.y * this.gridSize + this.gridSize / 2 + this.canvas.offsetTop
    };
  }
  getFoodPosition() {
    if (!this.food) return null;
    return {
      x:
        this.food.x * this.gridSize +
        this.gridSize / 2 +
        this.canvas.offsetLeft,
      y: this.food.y * this.gridSize + this.gridSize / 2 + this.canvas.offsetTop
    };
  }
  destroy() {
    this.state = "destroyed";
    window.removeEventListener("resize", this.handleResize);
    this.input.destroy();
    if (this.bonusFoodTimer) clearTimeout(this.bonusFoodTimer);
  }
}

class UIController {
  constructor() {
    this.elements = {
      mainContent: Utils.getElement("mainContent"),
      gameWorld: Utils.getElement("gameWorld"),
      startBtn: Utils.getElement("startBtn"),
      restartBtn: Utils.getElement("restartBtn"),
      menuBtn: Utils.getElement("menuBtn"),
      resumeBtn: Utils.getElement("resumeBtn"),
      pauseMenuBtn: Utils.getElement("pauseMenuBtn"),
      scoreDisplay: Utils.getElement("scoreDisplay"),
      lengthDisplay: Utils.getElement("lengthDisplay"),
      levelDisplay: Utils.getElement("levelDisplay"),
      highScoreDisplay: Utils.getElement("highScoreDisplay"),
      speedFill: Utils.getElement("speedFill"),
      gameOver: Utils.getElement("gameOver"),
      finalScore: Utils.getElement("finalScore"),
      finalLength: Utils.getElement("finalLength"),
      finalLevel: Utils.getElement("finalLevel"),
      finalHighScore: Utils.getElement("finalHighScore"),
      newRecord: Utils.getElement("newRecord"),
      pauseOverlay: Utils.getElement("pauseOverlay"),
      countdownOverlay: Utils.getElement("countdownOverlay"),
      countdownNumber: Utils.getElement("countdownNumber"),
      mobileControls: Utils.getElement("mobileControls"),
      menuHighScore: Utils.getElement("menuHighScore"),
      menuGamesPlayed: Utils.getElement("menuGamesPlayed")
    };
    if (Utils.isMobile() && this.elements.mobileControls)
      this.elements.mobileControls.classList.add("visible");
  }
  showMenu() {
    this.elements.mainContent?.classList.remove("hidden");
    this.elements.gameWorld?.classList.remove("active");
    this.hideGameOver();
    this.hidePause();
    this.hideCountdown();
  }
  showGame() {
    this.elements.mainContent?.classList.add("hidden");
    this.elements.gameWorld?.classList.add("active");
    this.hideGameOver();
    this.hidePause();
  }
  showGameOver(stats, isNewRecord) {
    if (this.elements.finalScore)
      this.elements.finalScore.textContent = stats.score;
    if (this.elements.finalLength)
      this.elements.finalLength.textContent = stats.length;
    if (this.elements.finalLevel)
      this.elements.finalLevel.textContent = stats.level;
    if (this.elements.finalHighScore)
      this.elements.finalHighScore.textContent = stats.highScore;
    if (this.elements.newRecord)
      this.elements.newRecord.style.display = isNewRecord ? "block" : "none";
    this.elements.gameOver?.classList.add("active");
  }
  hideGameOver() {
    this.elements.gameOver?.classList.remove("active");
  }
  showPause() {
    this.elements.pauseOverlay?.classList.add("active");
  }
  hidePause() {
    this.elements.pauseOverlay?.classList.remove("active");
  }
  async showCountdown() {
    return new Promise((resolve) => {
      this.elements.countdownOverlay?.classList.add("active");
      let count = 3;
      const tick = () => {
        if (this.elements.countdownNumber) {
          this.elements.countdownNumber.textContent = count > 0 ? count : "GO!";
          this.elements.countdownNumber.classList.remove("pop");
          void this.elements.countdownNumber.offsetWidth;
          this.elements.countdownNumber.classList.add("pop");
        }
        if (count > 0) {
          count--;
          setTimeout(tick, 800);
        } else {
          setTimeout(() => {
            this.hideCountdown();
            resolve();
          }, 500);
        }
      };
      tick();
    });
  }
  hideCountdown() {
    this.elements.countdownOverlay?.classList.remove("active");
  }
  updateScore(score, length) {
    if (this.elements.scoreDisplay)
      this.elements.scoreDisplay.textContent = score;
    if (this.elements.lengthDisplay)
      this.elements.lengthDisplay.textContent = length;
  }
  updateLevel(level) {
    if (this.elements.levelDisplay) {
      this.elements.levelDisplay.textContent = level;
      this.elements.levelDisplay.classList.remove("level-up");
      void this.elements.levelDisplay.offsetWidth;
      this.elements.levelDisplay.classList.add("level-up");
    }
  }
  updateSpeed(percentage) {
    if (this.elements.speedFill)
      this.elements.speedFill.style.width = `${percentage}%`;
  }
  updateHighScore(score) {
    if (this.elements.highScoreDisplay)
      this.elements.highScoreDisplay.textContent = score;
    if (this.elements.menuHighScore)
      this.elements.menuHighScore.textContent = score;
  }
  updateGamesPlayed(count) {
    if (this.elements.menuGamesPlayed)
      this.elements.menuGamesPlayed.textContent = count;
  }
  animateStartButton() {
    this.elements.startBtn?.classList.add("pressed");
    return new Promise((resolve) => setTimeout(resolve, 600));
  }
  resetStartButton() {
    this.elements.startBtn?.classList.remove("pressed");
  }
}

class Application {
  constructor() {
    this.game = null;
    this.particles = null;
    this.ui = null;
    this.settings = { speed: CONFIG.SPEED.NORMAL, mode: "classic" };
    this.stats = {
      highScore: Utils.storage.get(CONFIG.STORAGE.HIGH_SCORE, 0),
      gamesPlayed: Utils.storage.get(CONFIG.STORAGE.GAMES_PLAYED, 0)
    };
  }
  async init() {
    this.ui = new UIController();
    const particleCanvas = Utils.getElement("particleCanvas");
    if (particleCanvas) {
      this.particles = new ParticleSystem(particleCanvas);
      this.startParticleLoop();
    }
    const savedSettings = Utils.storage.get(CONFIG.STORAGE.SETTINGS);
    if (savedSettings) this.settings = { ...this.settings, ...savedSettings };
    this.ui.updateHighScore(this.stats.highScore);
    this.ui.updateGamesPlayed(this.stats.gamesPlayed);
    this.setupEventHandlers();
    this.setupAmbientEffect();
  }
  setupEventHandlers() {
    Utils.getElement("startBtn")?.addEventListener("click", (e) =>
      this.handleStart(e)
    );
    Utils.getElement("restartBtn")?.addEventListener("click", () =>
      this.handleRestart()
    );
    Utils.getElement("menuBtn")?.addEventListener("click", () =>
      this.handleMenu()
    );
    Utils.getElement("pauseMenuBtn")?.addEventListener("click", () =>
      this.handleMenu()
    );
    Utils.getElement("resumeBtn")?.addEventListener("click", () =>
      this.handleResume()
    );
    document.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".diff-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.settings.speed = parseInt(e.target.dataset.speed);
        Utils.storage.set(CONFIG.STORAGE.SETTINGS, this.settings);
      });
    });
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".mode-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.settings.mode = e.target.dataset.mode;
        Utils.storage.set(CONFIG.STORAGE.SETTINGS, this.settings);
      });
    });
    Utils.getElement("btnUp")?.addEventListener("click", () =>
      this.game?.input.queueDirection("up")
    );
    Utils.getElement("btnDown")?.addEventListener("click", () =>
      this.game?.input.queueDirection("down")
    );
    Utils.getElement("btnLeft")?.addEventListener("click", () =>
      this.game?.input.queueDirection("left")
    );
    Utils.getElement("btnRight")?.addEventListener("click", () =>
      this.game?.input.queueDirection("right")
    );
    Utils.getElement("btnPause")?.addEventListener("click", () =>
      this.handlePauseToggle()
    );
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Escape" || e.key === "p" || e.key === "P") && this.game) {
        e.preventDefault();
        this.handlePauseToggle();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.game?.state === "playing") {
        this.game.pause();
        this.ui.showPause();
      }
    });
  }
  setupAmbientEffect() {
    let lastMove = 0;
    document.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (now - lastMove < 16) return;
      lastMove = now;
      document.documentElement.style.setProperty("--mouse-x", e.clientX + "px");
      document.documentElement.style.setProperty("--mouse-y", e.clientY + "px");
    });
  }
  async handleStart(e) {
    if (e) {
      const rect = e.target.getBoundingClientRect();
      this.particles?.emit(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        30,
        "#00ffff",
        300
      );
    }
    await this.ui.animateStartButton();
    this.ui.showGame();
    await this.ui.showCountdown();
    this.startGame();
    setTimeout(() => this.ui.resetStartButton(), 100);
  }
  startGame() {
    if (this.game) this.game.destroy();
    const canvas = Utils.getElement("gameCanvas");
    this.game = new SnakeGame(canvas, {
      speed: this.settings.speed,
      mode: this.settings.mode,
      onScoreChange: (score, length) => {
        this.ui.updateScore(score, length);
        const speedPercent =
          ((CONFIG.SPEED.EASY - this.game.currentSpeed) /
            (CONFIG.SPEED.EASY - CONFIG.SPEED.MIN_SPEED)) *
          100;
        this.ui.updateSpeed(Utils.clamp(speedPercent, 0, 100));
      },
      onLevelUp: (level) => {
        this.ui.updateLevel(level);
        const pos = this.game.getSnakeHeadPosition();
        if (pos)
          this.particles?.emit(
            pos.x,
            pos.y,
            CONFIG.PARTICLES.LEVEL_UP,
            "#00ff88",
            250
          );
      },
      onFoodEaten: (food, isBonus) => {
        const pos =
          this.game.getFoodPosition() || this.game.getSnakeHeadPosition();
        if (pos)
          this.particles?.emit(
            pos.x,
            pos.y,
            isBonus ? 30 : CONFIG.PARTICLES.FOOD_COLLECT,
            food.color,
            200
          );
      },
      onGameOver: (stats) => this.handleGameOver(stats)
    });
    this.ui.updateScore(0, CONFIG.SNAKE.INITIAL_LENGTH);
    this.ui.updateLevel(1);
    this.ui.updateHighScore(this.stats.highScore);
    this.ui.updateSpeed(0);
    this.game.start();
  }
  handleGameOver(stats) {
    this.stats.gamesPlayed++;
    Utils.storage.set(CONFIG.STORAGE.GAMES_PLAYED, this.stats.gamesPlayed);
    this.ui.updateGamesPlayed(this.stats.gamesPlayed);
    const isNewRecord = stats.score > this.stats.highScore;
    if (isNewRecord) {
      this.stats.highScore = stats.score;
      Utils.storage.set(CONFIG.STORAGE.HIGH_SCORE, this.stats.highScore);
      this.ui.updateHighScore(this.stats.highScore);
    }
    const pos = this.game?.getSnakeHeadPosition();
    if (pos)
      this.particles?.emit(
        pos.x,
        pos.y,
        CONFIG.PARTICLES.DEATH,
        "#ff0066",
        300
      );
    setTimeout(() => {
      this.ui.showGameOver(
        { ...stats, highScore: this.stats.highScore },
        isNewRecord
      );
    }, 500);
  }
  handleRestart() {
    this.ui.hideGameOver();
    this.startGame();
  }
  handleMenu() {
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }
    this.ui.showMenu();
  }
  handlePauseToggle() {
    if (!this.game) return;
    if (this.game.state === "playing") {
      this.game.pause();
      this.ui.showPause();
    } else if (this.game.state === "paused") this.handleResume();
  }
  handleResume() {
    if (!this.game) return;
    this.ui.hidePause();
    this.game.resume();
  }
  startParticleLoop() {
    let lastTime = performance.now();
    const loop = (currentTime) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      this.particles?.update(dt);
      this.particles?.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const app = new Application();
  app.init();
});