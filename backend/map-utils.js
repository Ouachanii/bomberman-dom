// map-utils.js

// Initialize map (15x13 grid)
function initializeMap() {
  const map = [];
  for (let y = 0; y < 13; y++) {
    const row = [];
    for (let x = 0; x < 15; x++) {
      if (x === 0 || y === 0 || x === 14 || y === 12) {
        row.push('wall'); // Border walls
      } else if (x % 2 === 0 && y % 2 === 0) {
        row.push('wall'); // Grid walls
      } else if (isStartingPosition(x, y)) {
        row.push('empty'); // Starting positions always empty
      } else if (Math.random() < 0.6) {
        row.push('block'); // Destructible blocks
      } else {
        row.push('empty');
      }
    }
    map.push(row);
  }
  return map;
}

function isStartingPosition(x, y) {
  const startPositions = [
    [1, 1], [2, 1], [1, 2], // Top-left area
    [13, 1], [12, 1], [13, 2], // Top-right area
    [1, 11], [2, 11], [1, 10], // Bottom-left area
    [13, 11], [12, 11], [13, 10] // Bottom-right area
  ];
  return startPositions.some(([px, py]) => px === x && py === y);
}

function getStartingPosition(playerIndex) {
  const positions = [
    { x: 1, y: 1 }, // Top-left
    { x: 13, y: 1 }, // Top-right
    { x: 1, y: 11 }, // Bottom-left
    { x: 13, y: 11 } // Bottom-right
  ];
  return positions[playerIndex] || positions[0];
}

module.exports = {
  initializeMap,
  getStartingPosition,
  isStartingPosition
};