let bolts = [];
let boltCompleted = [];
let selectedBolt = null;
let solutionMoves = [];
let moveLog = [];
let numBolts = 0;

let undoStack = [];
let redoStack = [];

let colorShift = 0;
let boltShift = 0;

let colorRemap = {};
let boltRemap = {};

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
};

const colorAliases = {
  'b': 'blue',
  'r': 'red',
  'o': 'orange',
  'g': 'green',
  'y': 'yellow',
  'p': 'purple',
  'p': 'pink',
  'br': 'brown',
  'l': 'lime',
  'l_b': 'l_blue',
  'l_r': 'l_red',
  'l_g': 'l_green',
  'lb': 'l_blue',
  'lr': 'l_red',
  'lg': 'l_green',
  's': 'silver',
}

// --- Undo / Redo Logic ---
function saveState() {
  return {
    bolts: bolts.map(b => [...b]),
    boltCompleted: [...boltCompleted],
    selectedBolt: selectedBolt,
    solutionMoves: solutionMoves.map(m => ({...m})),
    moveLog: [...moveLog]
  };
}

function restoreState(state) {
  bolts = state.bolts.map(b => [...b]);
  boltCompleted = [...state.boltCompleted];
  selectedBolt = state.selectedBolt;
  solutionMoves = state.solutionMoves.map(m => ({...m}));
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
  if (e.key === 'r' || e.key === 'R') reset();
  if (e.key === 'n' || e.key === 'N') nest();
  if (e.key === 'e' || e.key === 'E') solve();
});
// -------------------------

// Helper to update solution display panel
function updateSolutionDisplay() {
  const container = document.getElementById('solutionContent');
  if (!container) return;
  if (!solutionMoves || solutionMoves.length === 0) {
    container.innerHTML = 'Click "Next Move" to generate optimal moves or advance to the next level.';
    container.classList.add('solution-empty');
    return;
  }
  container.classList.remove('solution-empty');
  const remaining = solutionMoves.length;

  let movesText = solutionMoves.map((move, idx) => { return `${move.src + 1}-${move.dst + 1}`}).join('\n');  
  movesText = `Moves remaining: ${remaining}\n<p>` + movesText;
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
      return colorAliases[trimmed] || trimmed;
    });
    stacks.push(colors);
  }
  
  const emptyBolts = num - stacks.length;
  for (let i = 0; i < emptyBolts; i++) {
    stacks.push([]);
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

  showMessage(`Moved ${nut} nut from bolt ${src+1} to bolt ${dst+1}`, 'info');

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

function checkSolved() {
  const allCompleted = bolts.every((_, i) => boltCompleted[i] || bolts[i].length === 0);
  if (allCompleted && bolts.some((_, i) => boltCompleted[i])) {
    return true;
  }
  return false;
}

function checkWinCondition() {
  if (checkSolved()) {
    showMessage('Solved! Click "Next Move" to load the next level.', 'info');
    return true;
  }
  return false;
}

function showMessage(msg, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = msg;
}

function updateVar(name, options) {
  if (options?.name==name) {
    let value = parseInt(options.value);
    document.getElementById(options.label).innerHTML = value;
    return value;
  }
}

function updateOptions(options) {
  colorShift = updateVar('colorShift', options) ?? colorShift;
  boltShift = updateVar('boltShift', options) ?? boltShift;
  renderGame();
}

function renderGame() {
  const colors = Object.keys(colorMap);

  colorRemap = {};
  if (colorShift) {
    for (let i = 0; i < colors.length; i++) {
      let j = ((i + colorShift) % colors.length + colors.length) % colors.length;
      colorRemap[colors[i]] = colors[j];
    }
  }

  boltRemap = {};
  if (boltShift) {
    for (let i = 0; i < bolts.length; i++) {
      let j = ((i + boltShift) % bolts.length + bolts.length) % bolts.length;
      boltRemap[i] = j;
    }
  }

  const gameArea = document.getElementById('gameArea');
  gameArea.innerHTML = '';

  for (let k = 0; k < bolts.length; k++) {
    let i = boltRemap[k] ?? k;

    const boltContainer = document.createElement('div');
    boltContainer.className = 'bolt-container';
    
    const bolt = document.createElement('div');
    bolt.className = 'bolt';

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
      const displayColor = colorRemap[color]||color;
      nut.className = `nut ${colorMap[displayColor] || 'color-blue'}`;
      
      if (selectedBolt === i && j === 0) {
        nut.classList.add('selected');
      }

      nut.textContent = displayColor;
      nutContainer.appendChild(nut);
    }
    
    bolt.appendChild(nutContainer);
    
    const header = document.createElement('div');
    header.className = 'bolt-header';
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
  if (boltCompleted[boltIndex]) {
    showMessage(`Bolt ${boltIndex + 1} is completed! Cannot move from or to completed bolts.`, 'error');
    return;
  }
  
  if (selectedBolt === null) {
    if (bolts[boltIndex].length > 0) {
      selectedBolt = boltIndex;
      renderGame();
      const topNut = bolts[boltIndex][0];
      showMessage(`Selected ${topNut} top nut of bolt ${boltIndex + 1}.`, 'info');
    } else {
      showMessage('Cannot select empty bolt!', 'error');
    }
  } else {
    if (selectedBolt === boltIndex) {
      return;
    }

    if (makeMove(selectedBolt, boltIndex, true)) {
      // Check if user deviated from the solution
      if (solutionMoves.length > 0) {
        if (solutionMoves[0].src === selectedBolt && solutionMoves[0].dst === boltIndex) {
          solutionMoves.shift();
        } else {
          solutionMoves = [];
        }
        updateSolutionDisplay();
      }

      selectedBolt = null;
      renderGame();
    } else {
      if (bolts[boltIndex].length > 0) {
        selectedBolt = boltIndex;
        renderGame();
        const topNut = bolts[boltIndex][0];
        showMessage(`Selected ${topNut} top nut of bolt ${boltIndex + 1}.`, 'info');
      } else {
        showMessage('Invalid move! Check color match and bolt capacity.', 'error');
        selectedBolt = null;
        renderGame();
      }
    }
  }
}

function reset() {
  const levelText = document.getElementById('levelInput').value;
  const parsed = parseLevel(levelText);
  if (parsed) {
    bolts = parsed.stacks.map(stack => [...stack]);
    boltCompleted = new Array(bolts.length).fill(false);
    selectedBolt = null;
    solutionMoves = [];
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

function loadLevel(levelNumber) {
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
  moveLog = [];
  undoStack = [];
  redoStack = [];
  updateMovesLog();
  renderGame();
  showMessage(`Level ${levelNumber} loaded! Click on bolts to play.`, 'info');
  checkAndMarkCompletedBolts();
  updateSolutionDisplay();
}

function solve() {
  if (checkSolved()) {
    showMessage('Already solved!', 'info');
    return;
  }
  showMessage('Solving... This may take a moment.', 'info');

  const boltsSnapshot = bolts.map(b => [...b]);
  const completedSnapshot = [...boltCompleted];
  const solution = findSolution(boltsSnapshot, completedSnapshot); // defined in solver.js
  if (solution && solution.length > 0) {
    solutionMoves = solution;
    updateSolutionDisplay();
    showMessage(`Solution found! ${solutionMoves.length} moves. Click "Next" to advance.`, 'success');
    document.querySelector('#nav-home-tab')?.click();
    return true;
  }

  showMessage('No solution found! Position might be unsolvable.', 'error');
  solutionMoves = [];
  updateSolutionDisplay();
  return false;
}

function nextLevel() {
  let levelNumber = location.hash ? parseInt(location.hash.slice(1)) : 1;
  levelNumber = (levelNumber+1) % 100;
  location.hash = levelNumber;
  fetchLevel(levelNumber);
  //showToast(`Loaded level ${levelNumber}`);
}

function next() {
  if (checkSolved()) {
    return nextLevel();
  }

  let solved = solutionMoves.length !== 0;

  if (!solved) {
    solved = solve();
  }

  if (!solved) return;
  
  const move = solutionMoves.shift();
  
  if (makeMove(move.src, move.dst, true)) {
    updateSolutionDisplay();
    if (solutionMoves.length === 0) {
      showMessage('Solution completed! Press "Next" for the next level.', 'success');
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
  reset: () => reset(),
  solve: () => solve()
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
      loadLevel(levelNumber);
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

  // Theme switcher
  const x = document.querySelector('#theme-switch');
  x.checked = localStorage.theme === 'dark';
  document.documentElement.dataset.bsTheme = x.checked ? 'dark' : 'light';

  x.onchange = _ => {
    const mode = x.checked ? 'dark' : 'light';
    localStorage.theme = mode;
    document.documentElement.dataset.bsTheme = mode;
  };
});

function showToast(message, title = 'Notification', duration = 2000) {
  const toastEl = document.getElementById('tempToast');
  toastEl.querySelector('.toast-body').textContent = message;
  const toast = new bootstrap.Toast(toastEl, {
    autohide: true,
    delay: duration
  });
  toast.show();
};
