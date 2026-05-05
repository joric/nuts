let bolts = [];
let boltCompleted = [];
let selectedBolt = null;
let solutionMoves = [];
let currentMoveIndex = 0;
let moveLog = [];
let numBolts = 0;

let undoStack = [];
let redoStack = [];

// --- Configs for Programmer ---
// Remap colors (e.g., {"blue": "orange", "orange": "blue"})
const colorRemap = {};
//const colorRemap = {};//{"orange": "lime", "red": "blue", "blue": "orange"}; //level1
//const colorRemap = {"l_green": "orange", "orange": "lime", "l_red":"red", "red": "green"};

// Remap bolt positions 0-indexed (e.g., {0: 1, 1: 0})
const boltRemap = {}; 
//const boltRemap = {0:6, 6:0}; 
// ------------------------------

const colorMap = {
  'blue': 'color-blue',
  'red': 'color-red',
  'orange': 'color-orange',
  'green': 'color-green',
  'yellow': 'color-yellow',
  'purple': 'color-purple',
  'pink': 'color-pink',
  'brown': 'color-brown',
  'lime': 'color-lime',
  'l_blue': 'color-l_blue',
  'l_red': 'color-l_red',
  'l_green': 'color-l_green',
  'silver': 'color-silver',

  'b': 'color-blue',
  'r': 'color-red',
  'o': 'color-orange',
  'g': 'color-green',
  'y': 'color-yellow',
  'p': 'color-purple',
  'p': 'color-pink',
  'b': 'color-brown',
  'l': 'color-lime',
  'l_b': 'color-l_blue',
  'l_r': 'color-l_red',
  'l_g': 'color-l_green',
  's': 'color-silver',
};

// --- Undo / Redo Logic ---
function saveState() {
  return {
    bolts: bolts.map(b => [...b]),
    boltCompleted: [...boltCompleted],
    selectedBolt: selectedBolt,
    solutionMoves: solutionMoves.map(m => ({...m})),
    currentMoveIndex: currentMoveIndex,
    moveLog: [...moveLog]
  };
}

function restoreState(state) {
  bolts = state.bolts.map(b => [...b]);
  boltCompleted = [...state.boltCompleted];
  selectedBolt = state.selectedBolt;
  solutionMoves = state.solutionMoves.map(m => ({...m}));
  currentMoveIndex = state.currentMoveIndex;
  moveLog = [...state.moveLog];
  
  updateMovesLog();
  updateSolutionDisplay();
  renderGame();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(saveState());
  restoreState(undoStack.pop());
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(saveState());
  restoreState(redoStack.pop());
}

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'z' || e.key === 'Z') undo();
  if (e.key === 'x' || e.key === 'X') redo();
});
// -------------------------

// Helper to update solution display panel
function updateSolutionDisplay() {
  const container = document.getElementById('solutionContent');
  if (!container) return;
  if (!solutionMoves || solutionMoves.length === 0) {
    container.innerHTML = 'Click "Solve" to generate optimal moves. Then use "Next Move".';
    container.classList.add('solution-empty');
    return;
  }
  container.classList.remove('solution-empty');
  const total = solutionMoves.length;
  const remaining = total - currentMoveIndex;
  let movesText = solutionMoves.map((move, idx) => {

    return `${idx===currentMoveIndex?'<b>':''} ${move.src+1}-${move.dst+1} ${idx===currentMoveIndex?'</b>':''}`;

  }).join('\n');
  if (currentMoveIndex >= total) {
    movesText = `SOLVED! (${total} moves total)\n` + movesText;
  } else {
    movesText = `Move ${currentMoveIndex+1}/${total}: ` + movesText;
  }
  container.innerHTML = movesText;
}

function parseLevel(levelText) {
  const lines = levelText.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;
  
  const num = parseInt(lines[0]);
  let stacks = [];
  
  for (let i = 1; i < lines.length; i++) {
    const colors = lines[i].split(',').map(c => {
      const trimmed = c.trim();
      return colorRemap[trimmed] || trimmed;
    });
    stacks.push(colors);
  }
  
  const emptyBolts = num - stacks.length;
  for (let i = 0; i < emptyBolts; i++) {
    stacks.push([]);
  }
  
  if (Object.keys(boltRemap).length > 0) {
    const remappedStacks = new Array(num).fill().map(() => []);
    for (let i = 0; i < num; i++) {
      const targetIdx = boltRemap[i] !== undefined ? boltRemap[i] : i;
      if (targetIdx < num) {
        remappedStacks[targetIdx] = stacks[i];
      }
    }
    stacks = remappedStacks;
  }

  return { numBolts: num, stacks: stacks };
}

function checkAndMarkCompletedBolts() {
  let changed = false;
  for (let i = 0; i < bolts.length; i++) {
    if (boltCompleted[i]) continue;
    
    if (bolts[i].length >= 4) {
      const top4 = bolts[i].slice(0, 4);
      if (top4.every(color => color === top4[0])) {
        boltCompleted[i] = true;
        changed = true;
        addMoveToLog(`Bolt ${i + 1} completed with 4 ${top4[0]} nuts!`);
      }
    }
  }
  if (changed) {
    renderGame();
    checkWinCondition();
    return true;
  }
  return false;
}

function canMove(src, dst) {
  if (src === dst) return false;
  if (boltCompleted[src]) return false;
  if (bolts[src].length === 0) return false;
  if (boltCompleted[dst]) return false;
  if (bolts[dst].length >= 4) return false;
  
  const srcTop = bolts[src][0];
  if (bolts[dst].length === 0) return true;
  
  const dstTop = bolts[dst][0];
  return srcTop === dstTop;
}

function makeMove(src, dst, record = true) {
  if (!canMove(src, dst)) return false;
  
  undoStack.push(saveState());
  redoStack = [];
  
  const nut = bolts[src].shift();
  bolts[dst].unshift(nut);
  
  if (record) {
    addMoveToLog(`${src + 1} -> ${dst + 1} (${nut})`);
  }
  
  renderGame();
  
  while (checkAndMarkCompletedBolts()) {
    renderGame();
  }
  
  checkWinCondition();
  return true;
}

function addMoveToLog(move) {
  moveLog.push(move);
  updateMovesLog();
}

function updateMovesLog() {
  const logElement = document.getElementById('movesLog');
  if (moveLog.length === 0) {
    logElement.textContent = 'No moves yet...';
  } else {
    logElement.textContent = moveLog.join('\n');
    logElement.scrollTop = logElement.scrollHeight;
  }
}

function checkWinCondition() {
  const allCompleted = bolts.every((_, i) => boltCompleted[i] || bolts[i].length === 0);
  if (allCompleted && bolts.some((_, i) => boltCompleted[i])) {
    showMessage('Solved! You can Reset the game or Select Level to continue', 'success');
    return true;
  }
  return false;
}

function showMessage(msg, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = msg;
  setTimeout(() => {
    if (document.getElementById('message').textContent === msg) {
      messageDiv.className = 'message info';
      let solved = checkWinCondition();
      messageDiv.textContent = solved ? 'Solved!' : 'Click on a bolt to select it, then click on another bolt to move the top nut';
    }
  }, 3000);
}

function renderGame() {
  const gameArea = document.getElementById('gameArea');
  gameArea.innerHTML = '';
  
  for (let i = 0; i < bolts.length; i++) {
    const boltContainer = document.createElement('div');
    boltContainer.className = 'bolt-container';
    
    const bolt = document.createElement('div');
    bolt.className = 'bolt';
    if (selectedBolt === i) {
      bolt.classList.add('selected');
    }
    if (boltCompleted[i]) {
      bolt.classList.add('completed');
    }
    
    const nutContainer = document.createElement('div');
    nutContainer.style.display = 'flex';
    nutContainer.style.flexDirection = 'column';
    nutContainer.style.width = '100%';
    nutContainer.style.alignItems = 'center';
    nutContainer.style.justifyContent = 'flex-start';
    
    for (let j = 0; j < bolts[i].length; j++) {
      const nut = document.createElement('div');
      const color = bolts[i][j];
      nut.className = `nut ${colorMap[color] || 'color-blue'}`;
      nut.textContent = color;
      nutContainer.appendChild(nut);
    }
    
    bolt.appendChild(nutContainer);
    
    const header = document.createElement('div');
    header.className = 'bolt-header';
    //header.innerHTML = `<span class="bolt-number">Bolt ${i + 1}</span><br>${bolts[i].length}/4`;
    header.innerHTML = `<span class="bolt-number">${i + 1}</span>`;
    
    boltContainer.appendChild(bolt);
    boltContainer.appendChild(header);
    
    bolt.onclick = (function(boltIndex) {
      return function() {
        handleBoltClick(boltIndex);
      };
    })(i);
    
    gameArea.appendChild(boltContainer);
  }
  
  const ground = document.createElement('div');
  ground.className = 'ground';
  gameArea.appendChild(ground);
}

function handleBoltClick(boltIndex) {
  if (solutionMoves.length > 0 && currentMoveIndex < solutionMoves.length) {
    showMessage('Auto-solver is active. Press Next Move or Reset to play manually.', 'error');
    return;
  }
  
  if (boltCompleted[boltIndex]) {
    showMessage(`Bolt ${boltIndex + 1} is completed! Cannot move from or to completed bolts.`, 'error');
    return;
  }
  
  if (selectedBolt === null) {
    if (bolts[boltIndex].length > 0) {
      selectedBolt = boltIndex;
      renderGame();
      const topNut = bolts[boltIndex][0];
      showMessage(`Selected bolt ${boltIndex + 1} (top nut: ${topNut})`, 'info');
    } else {
      showMessage('Cannot select empty bolt!', 'error');
    }
  } else {
    if (makeMove(selectedBolt, boltIndex, true)) {
      selectedBolt = null;
      renderGame();
    } else {
      showMessage('Invalid move! Check color match and bolt capacity.', 'error');
      selectedBolt = null;
      renderGame();
    }
  }
}

function resetGame() {
  const levelText = document.getElementById('levelInput').value;
  const parsed = parseLevel(levelText);
  if (parsed) {
    bolts = parsed.stacks.map(stack => [...stack]);
    boltCompleted = new Array(bolts.length).fill(false);
    selectedBolt = null;
    solutionMoves = [];
    currentMoveIndex = 0;
    moveLog = [];
    undoStack = [];
    redoStack = [];
    updateMovesLog();
    renderGame();
    showMessage('Game reset!', 'info');
    checkAndMarkCompletedBolts();
    updateSolutionDisplay(); 
    console.log('Game reset to (top-to-bottom):', bolts.map(b => [...b]));
  }
}

function loadLevel() {
  const levelText = document.getElementById('levelInput').value;
  const parsed = parseLevel(levelText);
  
  if (!parsed) {
    showMessage('Invalid level format!', 'error');
    return;
  }
  
  numBolts = parsed.numBolts;
  bolts = parsed.stacks.map(stack => [...stack]);
  boltCompleted = new Array(bolts.length).fill(false);
  selectedBolt = null;
  solutionMoves = [];
  currentMoveIndex = 0;
  moveLog = [];
  undoStack = [];
  redoStack = [];
  updateMovesLog();
  renderGame();
  showMessage('Level loaded! Click on bolts to play.', 'info');
  checkAndMarkCompletedBolts();
  updateSolutionDisplay();
}

// ----- BFS / IDA* solver (complete, finds optimal moves) -----
function getStateKey(boltsState, completedState) {
  let key = completedState.map(v => v ? '1' : '0').join('') + '|';
  for (let i = 0; i < boltsState.length; i++) {
    key += boltsState[i].join(',') + ';';
  }
  return key;
}

function getPossibleMoves(boltsState, completedState) {
  const moves = [];
  const n = boltsState.length;
  for (let src = 0; src < n; src++) {
    if (completedState[src]) continue;
    if (boltsState[src].length === 0) continue;
    for (let dst = 0; dst < n; dst++) {
      if (src === dst) continue;
      if (completedState[dst]) continue;
      if (boltsState[dst].length >= 4) continue;
      const srcTop = boltsState[src][0];
      if (boltsState[dst].length === 0) {
        moves.push({ src, dst });
      } else {
        const dstTop = boltsState[dst][0];
        if (srcTop === dstTop) {
          moves.push({ src, dst });
        }
      }
    }
  }
  return moves;
}

function applyMove(state, completed, move) {
  const newBolts = state.map(bolt => [...bolt]);
  const newCompleted = [...completed];
  const nut = newBolts[move.src].shift();
  newBolts[move.dst].unshift(nut);
  for (let i = 0; i < newBolts.length; i++) {
    if (!newCompleted[i] && newBolts[i].length >= 4) {
      const top4 = newBolts[i].slice(0, 4);
      if (top4.every(c => c === top4[0])) {
        newCompleted[i] = true;
      }
    }
  }
  return { bolts: newBolts, completed: newCompleted };
}

function isGoal(completed) {
  return completed.every(v => v === true);
}

function heuristic(boltsState, completedState) {
  let penalty = 0;
  for (let i = 0; i < boltsState.length; i++) {
    if (completedState[i]) continue;
    const stack = boltsState[i];
    if (stack.length === 0) continue;
    let colorGroup = 0;
    let currentColor = null;
    for (let j = 0; j < stack.length; j++) {
      if (stack[j] !== currentColor) {
        colorGroup++;
        currentColor = stack[j];
      }
    }
    penalty += colorGroup;
    const colorCounts = new Map();
    for (let c of stack) colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
    for (let cnt of colorCounts.values()) {
      if (cnt >= 4) penalty -= 1;
    }
  }
  return penalty;
}

function solveGame() {
  showMessage('Solving... This may take a moment.', 'info');
  setTimeout(() => {
    const boltsSnapshot = bolts.map(b => [...b]);
    const completedSnapshot = [...boltCompleted];
    const solution = findSolution(boltsSnapshot, completedSnapshot); // defined in solver.js
    if (solution && solution.length > 0) {
      solutionMoves = solution;
      currentMoveIndex = 0;
      updateSolutionDisplay();
      showMessage(`Solution found! ${solutionMoves.length} moves. Click "Next Move" to execute.`, 'success');
    } else {
      showMessage('No solution found! The level might be unsolvable.', 'error');
      solutionMoves = [];
      updateSolutionDisplay();
    }
  }, 50);
}

function stepSolution() {
  if (solutionMoves.length === 0) {
    showMessage('No solution loaded. Click "Solve" first.', 'error');
    return;
  }
  
  if (currentMoveIndex >= solutionMoves.length) {
    showMessage('Solution complete!', 'success');
    updateSolutionDisplay();
    return;
  }
  
  const move = solutionMoves[currentMoveIndex];
  
  if (makeMove(move.src, move.dst, true)) {
    currentMoveIndex++;
    updateSolutionDisplay();
    if (currentMoveIndex >= solutionMoves.length) {
      showMessage('Solution completed!', 'success');
    }
  } else {
    showMessage('Error executing solution move!', 'error');
    solutionMoves = [];
    updateSolutionDisplay();
  }
}

window.debug = {
  getState: () => bolts.map(b => [...b]),
  getCompleted: () => [...boltCompleted],
  reset: () => resetGame(),
  solve: () => solveGame()
};

window.addEventListener('DOMContentLoaded', function() {
  const select = document.querySelector('#levelSelector');
  for (let i = 1; i <= 100; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    select.appendChild(option);
  }
});

function fetchLevel(levelNumber) {
  const textarea = document.getElementById('levelInput');
  const select = document.querySelector('#levelSelector');
  fetch(`data/Level${levelNumber}.txt`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Level ${levelNumber} not found`);
      }
      return response.text();
    })
    .then(data => {
      textarea.value = data;
      select.selectedIndex = levelNumber-1;
      loadLevel();
    })
    .catch(error => {
      console.error('Error:', error);
      textarea.value = `Error: Could not load Level ${levelNumber}.txt\n\nMake sure the file exists at: data/Level${levelNumber}.txt`;
    });
}

function select_level() {
  const select = document.querySelector('#levelSelector');
  const levelNumber = select.value;
  location.hash = levelNumber;
  fetchLevel(levelNumber);
}

document.addEventListener('DOMContentLoaded', function() {
  let levelNumber = location.hash ? parseInt(location.hash.slice(1)) : 1;
  fetchLevel(levelNumber);
});
