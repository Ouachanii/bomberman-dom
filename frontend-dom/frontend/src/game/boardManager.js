import FacileJS from '../../framework/index.js';

const TILE = { EMPTY: 0, BLOCK: 1, WALL: 2 };

export const boardManager = {
    CELL_SIZE: 50,
    dynamicElementContainer: null,
    playerPool: new Map(),
    bombPool: new Map(),
    explosionPool: new Map(),
    powerUpPool: new Map(),
    activeElements: new Set(),

    createBoard(map) {
        const wallAndBlockCells = [];
        map.forEach((row, y) => {
            row.forEach((tile, x) => {
                if (tile === TILE.WALL || tile === TILE.BLOCK) {
                    const tileClass = tile === TILE.WALL ? 'cell wall' : 'cell block';
                    wallAndBlockCells.push(FacileJS.createElement('div', {
                        class: tileClass,
                        style: `grid-column: ${x + 1}; grid-row: ${y + 1};`
                    }));
                }
            });
        });

        const dynamicContainerVNode = FacileJS.createElement('div', {
            class: 'dynamic-container',
            ref: (el) => { if (el) this.dynamicElementContainer = el; }
        });

        return FacileJS.createElement('div', {
            class: 'board',
            style: `grid-template-columns: repeat(${map[0].length}, ${this.CELL_SIZE}px); grid-template-rows: repeat(${map.length}, ${this.CELL_SIZE}px);`
        }, ...wallAndBlockCells, dynamicContainerVNode);
    },

    updatePool({ pool, items, key, className, updateFunc, tag = 'div' }) {
        if (!this.dynamicElementContainer) return;
        items.forEach(item => {
            const itemKey = key(item);
            const fullKey = `${className}-${itemKey}`;
            this.activeElements.add(fullKey);
            let el = pool.get(itemKey);
            if (!el) {
                el = document.createElement(tag);
                pool.set(itemKey, el);
                this.dynamicElementContainer.appendChild(el);
            }
            updateFunc(el, item);
        });
    },

    update(gameState) {
        if (!this.dynamicElementContainer) return;
        this.activeElements.clear();

        this.updatePool({
            pool: this.playerPool,
            items: gameState.players,
            key: p => p.id,
            className: 'player',
            tag: 'img', // Create an <img> element for players
            updateFunc: (el, p) => {
                el.className = `player player-${p.id} ${p.isAlive ? '' : 'dead'}`;
                el.src = 'assets/ghost.png'; // Use local ghost image
                el.style.transform = `translate(${p.x}px, ${p.y}px)`;
            }
        });

        this.updatePool({
            pool: this.bombPool,
            items: gameState.bombs || [],
            key: b => `${b.x}-${b.y}`,
            className: 'bomb',
            tag: 'img', // Create an <img> element
            updateFunc: (el, b) => {
                el.className = 'bomb';
                el.src = 'https://static.thenounproject.com/png/2881495-200.png'; // Set the image source
                const x = b.x * this.CELL_SIZE;
                const y = b.y * this.CELL_SIZE;
                el.style.transform = `translate(${x}px, ${y}px)`;
            }
        });

        this.updatePool({
            pool: this.powerUpPool, items: gameState.powerUps || [], key: p => `${p.x}-${p.y}`, className: 'power-up',
            updateFunc: (el, p) => {
                el.className = `power-up ${p.type}`;
                const x = p.x * this.CELL_SIZE;
                const y = p.y * this.CELL_SIZE;
                el.style.transform = `translate(${x}px, ${y}px)`;
            }
        });

        const explosionCells = new Map();
        (gameState.explosions || []).forEach(exp => {
            exp.cells.forEach(cell => {
                const key = `${cell.x}-${cell.y}`;
                if (!explosionCells.has(key)) explosionCells.set(key, cell);
            });
        });

        this.updatePool({
            pool: this.explosionPool, items: Array.from(explosionCells.values()), key: cell => `${cell.x}-${cell.y}`, className: 'explosion',
            updateFunc: (el, cell) => {
                el.className = 'explosion';
                const x = cell.x * this.CELL_SIZE;
                const y = cell.y * this.CELL_SIZE;
                el.style.transform = `translate(${x}px, ${y}px)`;
            }
        });

        const cleanup = (pool, prefix) => {
            for (const [key, el] of pool.entries()) {
                if (!this.activeElements.has(`${prefix}-${key}`)) {
                    el.remove();
                    pool.delete(key);
                }
            }
        };

        cleanup(this.playerPool, 'player');
        cleanup(this.bombPool, 'bomb');
        cleanup(this.powerUpPool, 'power-up');
        cleanup(this.explosionPool, 'explosion');
    },

    reset() {
        if (this.dynamicElementContainer) {
            this.dynamicElementContainer.innerHTML = '';
        }
        this.playerPool.clear();
        this.bombPool.clear();
        this.explosionPool.clear();
        this.powerUpPool.clear();
        this.activeElements.clear();
    }
};
