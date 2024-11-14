// popup.js
let isRunning = false;
let globalHistory = [];
let bestComboGlobal = null;

async function loadState() {
  const state = await chrome.storage.local.get(['isRunning', 'history']);
  isRunning = state.isRunning || false;
  globalHistory = state.history || [];
  
  // Update UI based on loaded state
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (isRunning) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }
  
  updateHistoryUI();
}


// Save state to storage
async function saveState() {
  await chrome.storage.local.set({
    isRunning,
    history: globalHistory
  });
}

function injectOptimizer(tab, delay) {
  // Previous inject code remains the same...
}




async function handleNewScore(currentScore, currentCombo) {
  if (currentScore > bestScore) {
    bestScore = currentScore;
    bestCombo = currentCombo;
    chrome.runtime.sendMessage({
      type: 'newBestScore',
      score: currentScore,
      combo: currentCombo,
      timestamp: new Date().toLocaleTimeString()
    });
    await saveState();
  }
}




function injectOptimizer(tab, delay) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function(delayMs) {
      let isRunning = true;
      let bestScore = -Infinity;
      let bestCombo = null;
      let lastScore = null;

      function getScore() {
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          const measureCell = row.querySelector('td.measure');
          if (measureCell && measureCell.textContent.includes('Earnings Per Share')) {
            const scoreCell = row.querySelector('td.score.text-center');
            if (scoreCell) {
              const epsText = scoreCell.textContent;
              const eps = parseFloat(epsText.replace('$', ''));
              return isNaN(eps) ? null : eps;
            }
          }
        }
        return null;
      }

      function setInputValue(input, value) {
        input.value = value;
        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new Event('blur', { bubbles: true }),
          new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
          new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
          new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })
        ];
        events.forEach(event => input.dispatchEvent(event));
      }

      function setSelectValue(select, value) {
        const options = Array.from(select.options);
        const index = options.findIndex(o => o.value === value);
        if (index !== -1) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      function clickCalculate() {
        const buttons = Array.from(document.getElementsByTagName('button'));
        const calcBtn = buttons.find(b => 
          b.textContent.toLowerCase().includes('calculate') || 
          b.textContent.toLowerCase().includes('update scores')
        );
        if (calcBtn) {
          calcBtn.click();
          return true;
        }
        return false;
      }

      window.applyCombo = function(combo) {
        // First, collect all inputs and selects
        const inputs = document.querySelectorAll('input[type="number"], input[formcontrolname]');
        const selects = document.querySelectorAll('select');
        
        // Apply values to inputs
        inputs.forEach(input => {
          const id = input.id || input.name;
          if (combo[id]) {
            setInputValue(input, combo[id].value);
          }
        });
        
        // Apply values to selects
        selects.forEach(select => {
          const id = select.id || select.name;
          if (combo[id]) {
            setSelectValue(select, combo[id].value);
          }
        });
        
        // Click calculate after all values are set
        setTimeout(() => clickCalculate(), 100);
      };

      // Function to capture current values
      function captureCurrentValues() {
        const currentCombo = {};
        const inputs = document.querySelectorAll('input[type="number"], input[formcontrolname]');
        const selects = document.querySelectorAll('select');

        inputs.forEach(input => {
          const id = input.id || input.name;
          const label = input.previousElementSibling?.textContent || 
                       input.closest('label')?.textContent || 
                       id || 'Unnamed Input';
          currentCombo[id] = {
            value: input.value,
            label: label.trim()
          };
        });

        selects.forEach(select => {
          const id = select.id || select.name;
          const label = select.previousElementSibling?.textContent || 
                       select.closest('label')?.textContent || 
                       id || 'Unnamed Select';
          currentCombo[id] = {
            value: select.value,
            label: label.trim()
          };
        });

        return currentCombo;
      }

      // Set up a MutationObserver to watch for score changes
      const observer = new MutationObserver(() => {
        const currentScore = getScore();
        if (currentScore !== null && currentScore !== lastScore) {
          lastScore = currentScore;
          const currentCombo = captureCurrentValues();
          
          chrome.runtime.sendMessage({
            type: 'newScore',
            score: currentScore,
            combo: currentCombo,
            timestamp: new Date().toLocaleTimeString()
          });

          if (currentScore > bestScore) {
            bestScore = currentScore;
            bestCombo = currentCombo;
            chrome.runtime.sendMessage({
              type: 'newBestScore',
              score: currentScore,
              combo: currentCombo,
              timestamp: new Date().toLocaleTimeString()
            });
          }
        }
      });

      // Start observing the entire document for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      let consecutiveFailedAttempts = 0;
      const MAX_FAILED_ATTEMPTS = 10;
      const BACKOFF_DELAY = 5000;

      async function tryValues() {
        const inputs = document.querySelectorAll('input[type="number"], input[formcontrolname]');
        const selects = document.querySelectorAll('select');

        // Randomize values
        inputs.forEach(input => {
          const min = parseFloat(input.min) || 500;
          const max = parseFloat(input.max) || 5000;
          const step = parseFloat(input.step) || 1;
          const steps = Math.floor((max - min) / step);
          const value = min + (Math.floor(Math.random() * steps) * step);
          setInputValue(input, value);
        });

        selects.forEach(select => {
          const options = Array.from(select.options);
          if (options.length > 0) {
            const randomIndex = Math.floor(Math.random() * options.length);
            setSelectValue(select, options[randomIndex].value);
          }
        });

        if (clickCalculate()) {
          const currentScore = getScore();
          if (currentScore !== null && currentScore > bestScore) {
            consecutiveFailedAttempts = 0;
            await handleNewScore(currentScore, currentCombo);
          } else {
            consecutiveFailedAttempts++;
            if (consecutiveFailedAttempts >= MAX_FAILED_ATTEMPTS) {
              consecutiveFailedAttempts = 0;
              await new Promise(resolve => setTimeout(resolve, BACKOFF_DELAY));
            }
          }
        }
      }

      // Capture and send initial state
      const initialScore = getScore();
      if (initialScore !== null) {
        bestScore = initialScore;
        lastScore = initialScore;
        chrome.runtime.sendMessage({
          type: 'initialScore',
          score: initialScore,
          combo: captureCurrentValues(),
          timestamp: new Date().toLocaleTimeString()
        });
      }

      async function optimize() {
        while (isRunning) {
          await tryValues();
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      optimize();
      window.stopOptimizer = () => { 
        isRunning = false;
        observer.disconnect();
      };
    },
    args: [delay]
  });
}

function stopOptimizer(tab) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if (window.stopOptimizer) window.stopOptimizer();
    }
  });
  isRunning = false;
  saveState();
}

function applyHistoryCombo(tab, combo) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (comboData) => {
      if (window.applyCombo) {
        window.applyCombo(comboData);
      }
    },
    args: [combo]
  });
}

function updateHistoryUI() {
  const historyContainer = document.getElementById('history');
  const bestScoreEl = document.getElementById('bestScore');
  
  if (!historyContainer || !bestScoreEl) return;
  
  // Update best score and make it clickable
  if (globalHistory.length > 0) {
    const bestEntry = globalHistory.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    bestScoreEl.innerHTML = `
      <div style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>Best EPS: $${bestEntry.score.toFixed(2)}</span>
        <button class="apply-button">Apply Values</button>
      </div>
    `;
    
    // Add click handler for best score
    const applyButton = bestScoreEl.querySelector('.apply-button');
    if (applyButton && bestEntry.combo) {
      applyButton.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        applyHistoryCombo(tab, bestEntry.combo);
      });
    }
  }
  
  // Update history list
  historyContainer.innerHTML = '';
  globalHistory.slice().reverse().forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const scoreInfo = document.createElement('div');
    scoreInfo.className = 'score-info';
    scoreInfo.innerHTML = `
      <div class="score-header">
        <span class="timestamp">${entry.timestamp}</span>
        <span class="score">EPS: $${entry.score.toFixed(2)}</span>
      </div>
    `;
    
    if (entry.combo) {
      const applyButton = document.createElement('button');
      applyButton.className = 'apply-button';
      applyButton.textContent = 'Apply Values';
      applyButton.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        applyHistoryCombo(tab, entry.combo);
      });
      scoreInfo.appendChild(applyButton);
      
      const details = document.createElement('div');
      details.className = 'details';
      details.style.display = 'none';
      
      for (const [id, info] of Object.entries(entry.combo)) {
        details.innerHTML += `
          <div class="detail-item">
            <span class="detail-label">${info.label}:</span>
            <span class="detail-value">${info.value}</span>
          </div>
        `;
      }
      
      item.appendChild(scoreInfo);
      item.appendChild(details);
      
      scoreInfo.addEventListener('click', (e) => {
        if (!e.target.classList.contains('apply-button')) {
          const currentDisplay = details.style.display;
          details.style.display = currentDisplay === 'none' ? 'block' : 'none';
        }
      });
    }
    
    historyContainer.appendChild(item);
  });
}
let startBtn, stopBtn, bestScoreEl, historyContainer;

document.addEventListener('DOMContentLoaded', async () => {
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  bestScoreEl = document.getElementById('bestScore');
  historyContainer = document.getElementById('history');
  await loadState();

  const style = document.createElement('style');
  style.textContent = `
    .best-score {
      font-size: 16px;
      font-weight: bold;
      margin: 10px 0;
      padding: 5px;
      background-color: #f0f0f0;
      border-radius: 4px;
      cursor: pointer;
    }
    .history-container {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-top: 10px;
    }
    .history-item {
      border-bottom: 1px solid #eee;
    }
    .score-info {
      padding: 8px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .score-info:hover {
      background-color: #f5f5f5;
    }
    .score-header {
      flex-grow: 1;
    }
    .timestamp {
      color: #666;
      font-size: 12px;
      margin-right: 10px;
    }
    .score {
      font-weight: bold;
    }
    .details {
      padding: 8px;
      background-color: #f9f9f9;
      border-top: 1px solid #eee;
    }
    .detail-item {
      margin: 4px 0;
      font-size: 12px;
    }
    .detail-label {
      color: #666;
      margin-right: 5px;
    }
    .detail-value {
      font-weight: bold;
    }
    .apply-button {
      padding: 4px 8px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-left: 8px;
    }
    .apply-button:hover {
      background-color: #45a049;
    }
  `;
  document.head.appendChild(style);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'initialScore' || message.type === 'newScore') {
      globalHistory.push({
        score: message.score,
        combo: message.combo,
        timestamp: message.timestamp
      });
      saveState();
      updateHistoryUI();
    }
  });

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const delay = parseInt(document.getElementById('delay').value) || 2000;
    
    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    
    // Don't clear history when starting new optimization
    // globalHistory = [];
    saveState();
    updateHistoryUI();
    
    injectOptimizer(tab, delay);
  });

  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    
    stopOptimizer(tab);
  });
});