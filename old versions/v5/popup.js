// popup.js
let isRunning = false;
let globalHistory = [];
let bestComboGlobal = null;
let bestScore = 0;

async function loadState() {
  const state = await chrome.storage.local.get(['isRunning', 'history', 'bestScore']);
  isRunning = state.isRunning || false;
  globalHistory = state.history || [];
  bestScore = state.bestScore || 0;
  
  // Update UI based on loaded state
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const bestScoreEl = document.getElementById('bestScore');

  if (isRunning) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }

  updateBestScoreDisplay();
}

function updateBestScoreDisplay() {
  const bestScoreEl = document.getElementById('bestScore');
  if (bestScoreEl) {
    // Calculate best score from history if available
    const historyBestScore = globalHistory.length > 0 
      ? Math.max(...globalHistory.map(entry => entry.score))
      : bestScore;
    
    // Use the higher value between stored bestScore and history best score
    bestScore = Math.max(bestScore, historyBestScore);
    bestScoreEl.textContent = `Best EPS: $${bestScore.toFixed(2)}`;
  }
}

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({
    isRunning,
    history: globalHistory,
    bestScore
  });
}


async function handleNewScore(currentScore, currentCombo) {
  if (currentScore && currentScore > bestScore) { // Added null check
    bestScore = currentScore;
    bestComboGlobal = currentCombo;
    chrome.runtime.sendMessage({
      type: 'newBestScore',
      score: currentScore,
      combo: currentCombo,
      timestamp: new Date().toLocaleTimeString()
    });
    globalHistory = [
      {
        score: currentScore,
        combo: currentCombo,
        timestamp: new Date().toLocaleTimeString()
      }
    ];
    await saveState();
    const bestScoreEl = document.getElementById('bestScore');
    bestScoreEl.textContent = `Best EPS: $${bestScore.toFixed(2)}`;
  }
}



function injectOptimizer(tab, delay) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function(delayMs) {
      let isRunning = true;
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

      // Initialize bestScore with current EPS
      let bestScore = getScore() || 0;

      function setInputValue(input, value) {
        input.value = value;
        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new Event('blur', { bubbles: true })
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
        // Update selector to get all input fields
        const inputs = document.querySelectorAll('input.input-field');
        const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');

        inputs.forEach(input => {
          const id = input.id || input.name;
          const label = input.title || 
                       input.getAttribute('aria-label') || 
                       input.previousElementSibling?.textContent || 
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

      async function optimizeSelect(select) {
        if (select.classList.contains('entry-assumptions-select')) {
          return null;
        }

        let bestOption = null;
        let bestSelectScore = -Infinity;
        const options = Array.from(select.options);
        
        for (const option of options) {
          setSelectValue(select, option.value);
          clickCalculate();
          await new Promise(r => setTimeout(r, delayMs));
          const currentScore = getScore();
          
          if (currentScore > bestSelectScore) {
            bestOption = option;
            bestSelectScore = currentScore;
            
            if (currentScore > bestScore) {
              bestScore = currentScore;
              chrome.runtime.sendMessage({
                type: 'newBestScore',
                score: currentScore,
                combo: captureCurrentValues(),
                timestamp: new Date().toLocaleTimeString()
              });
            }
          }
        }
        
        if (bestOption) {
          setSelectValue(select, bestOption.value);
          clickCalculate();
        }
        
        return bestSelectScore;
      }

      

      const observer = new MutationObserver(() => {
        const currentScore = getScore();
        if (currentScore !== null && currentScore !== lastScore && currentScore > bestScore) {
          lastScore = currentScore;
          chrome.runtime.sendMessage({
            type: 'newScore',
            score: currentScore,
            combo: captureCurrentValues(),
            timestamp: new Date().toLocaleTimeString()
          });
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      let consecutiveFailedAttempts = 0;
      const MAX_FAILED_ATTEMPTS = 10;
      const BACKOFF_DELAY = 5000;


      async function tryValues() {
        // Get all inputs but filter out assumption-related ones
        const inputs = Array.from(document.querySelectorAll(`
          input[type="number"],
          input[type="text"].form-control.input-field,
          input[formcontrolname]
        `)).filter(input => !isAssumptionField(input));
      
        const selects = Array.from(document.querySelectorAll('select'))
          .filter(select => !isAssumptionField(select));
      
        // Helper to identify assumption-related fields
        function isAssumptionField(element) {
          // Check various identifiers for assumption fields
          return (
            element.classList.contains('entry-assumptions-select') ||
            element.classList.contains('glo-entry-select') ||
            element.closest('.entry-assumptions') !== null ||
            (element.id && element.id.startsWith('G')) || // Assumption fields often start with G
            (element.getAttribute('aria-label') && (
              element.getAttribute('aria-label').includes('Average') ||
              element.getAttribute('aria-label').includes('Number of Models') ||
              element.getAttribute('aria-label').includes('Market Share') ||
              element.getAttribute('aria-label').includes('Industry') ||
              element.getAttribute('aria-label').includes('Competitor')
            ))
          );
        }
      
        // Helper to determine if an input should be treated as numeric
        function isNumericInput(input) {
          const title = input.title?.toLowerCase() || '';
          const label = input.getAttribute('aria-label')?.toLowerCase() || '';
          return (
            input.type === 'number' ||
            title.includes('price') ||
            title.includes('cost') ||
            title.includes('quantity') ||
            title.includes('rate') ||
            title.includes('amount') ||
            title.includes('displays') ||
            title.includes('budget') ||
            label.includes('price') ||
            label.includes('cost') ||
            label.includes('quantity') ||
            label.includes('rate') ||
            label.includes('amount') ||
            label.includes('displays') ||
            label.includes('budget')
          );
        }
      
        // Helper to get valid range for an input based on its context
        function getInputRange(input) {
          const title = input.title?.toLowerCase() || '';
          const label = input.getAttribute('aria-label')?.toLowerCase() || '';
          
          if (title.includes('price') || label.includes('price')) {
            return { min: 1, max: 999, step: 0.5 }; // Price range
          } else if (title.includes('displays') || label.includes('displays')) {
            return { min: 0, max: 1000000, step: 1000 }; // Display budget
          } else if (title.includes('budget') || label.includes('budget')) {
            return { min: 0, max: 10000000, step: 10000 }; // General budget
          } else if (title.includes('quantity') || label.includes('quantity')) {
            return { min: 0, max: 1000000, step: 1000 }; // Quantity
          }
          
          return { 
            min: parseFloat(input.min) || 0,
            max: parseFloat(input.max) || 1000000,
            step: parseFloat(input.step) || 1
          };
        }
      
        // Try optimizing one input at a time
        for (const input of inputs) {
          // Skip non-numeric inputs
          if (!isNumericInput(input)) continue;
      
          const { min, max, step } = getInputRange(input);
          let bestValue = parseFloat(input.value) || min;
          let bestScore = await getCurrentScore();
          
          console.log(`Optimizing: ${input.title || input.getAttribute('aria-label')} (Current: ${bestValue})`);
          
          // Define variations based on input type
          const baseValue = parseFloat(input.value) || min;
          const percentages = [-20, -10, -5, 5, 10, 20];
          const variations = percentages.map(p => baseValue * (1 + p/100))
                                      .concat([min, max, (min + max)/2]);
          
          for (const newValue of variations) {
            const clampedValue = Math.min(max, Math.max(min, newValue));
            
            if (Math.abs(clampedValue - bestValue) < step/2) continue;
            
            setInputValue(input, clampedValue);
            await clickCalculate();
            const score = await getCurrentScore();
            
            if (score > bestScore) {
              bestScore = score;
              bestValue = clampedValue;
              console.log(`New best value: ${bestValue} (Score: ${bestScore})`);
            }
          }
          
          // Fine-tune around best value
          const fineSteps = [-2, -1, 1, 2];
          for (const multiplier of fineSteps) {
            const newValue = bestValue + (multiplier * step);
            if (newValue < min || newValue > max) continue;
            
            setInputValue(input, newValue);
            await clickCalculate();
            const score = await getCurrentScore();
            
            if (score > bestScore) {
              bestScore = score;
              bestValue = newValue;
            }
          }
          
          setInputValue(input, bestValue);
        }
      
        // Helper to get current score with timeout
        async function getCurrentScore() {
          await new Promise(resolve => setTimeout(resolve, 100));
          return getScore() || -Infinity;
        }
      }

    // Enhanced input value setter
    function setInputValue(input, value) {
      const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
      
      if (input.value !== formattedValue) {
        input.value = formattedValue;
        
        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new Event('blur', { bubbles: true }),
          new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }),
          new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true })
        ];
        
        events.forEach(event => input.dispatchEvent(event));
      }
    }

    // Enhanced select value setter
    function setSelectValue(select, value) {
      const options = Array.from(select.options);
      const index = options.findIndex(o => o.value === value);
      
      if (index !== -1 && select.selectedIndex !== index) {
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Enhanced calculation handler
    async function clickCalculate() {
      const calcBtn = Array.from(document.getElementsByTagName('button'))
        .find(b => b.textContent.toLowerCase().includes('calculate') || 
                  b.textContent.toLowerCase().includes('update scores'));
                  
      if (calcBtn) {
        calcBtn.click();
        await new Promise(resolve => setTimeout(resolve, 200));
        return true;
      }
      return false;
    }

    async function optimizeInput(input) {
      // Get input limits from the title or aria-label
      const inputTitle = input.title || input.getAttribute('aria-label') || '';
      const isNA = inputTitle.toLowerCase().includes('n.a.');
      const isAP = inputTitle.toLowerCase().includes('a-p');
      
      // Set appropriate min/max based on region
      let min = 0;
      let max = isNA ? 10000 : (isAP ? 5000 : 10000); // Default to 10000 if region unknown
      const step = 1;
      
      let currentValue = Math.floor((max + min) / 2);
      setInputValue(input, currentValue);
      clickCalculate();
      await new Promise(r => setTimeout(r, delayMs));
      let currentScore = getScore();
      let bestValue = currentValue;
      let bestInputScore = currentScore;
      
      const directions = [-1, 1];
      for (const direction of directions) {
        let improving = true;
        let stepSize = Math.floor((max - min) / 10);
        
        while (improving && stepSize >= step) {
          improving = false;
          let newValue = currentValue + (direction * stepSize);
          
          if (newValue >= min && newValue <= max) {
            setInputValue(input, newValue);
            clickCalculate();
            await new Promise(r => setTimeout(r, delayMs));
            let newScore = getScore();
            
            if (newScore > bestInputScore) {
              bestInputScore = newScore;
              bestValue = newValue;
              currentValue = newValue;
              improving = true;
              
              if (newScore > bestScore) {
                bestScore = newScore;
                chrome.runtime.sendMessage({
                  type: 'newBestScore',
                  score: newScore,
                  combo: captureCurrentValues(),
                  timestamp: new Date().toLocaleTimeString()
                });
              }
            }
          }
          
          if (!improving) {
            stepSize = Math.floor(stepSize / 2);
          }
        }
      }
      
      setInputValue(input, bestValue);
      clickCalculate();
      return bestInputScore;
    }

      

    async function optimize() {
      while (isRunning) {
        const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');
        for (const select of selects) {
          if (!isRunning) break;
          await optimizeSelect(select);
        }
        
        // Update selector to get all input fields
        const inputs = document.querySelectorAll('input.input-field');
        for (const input of inputs) {
          if (!isRunning) break;
          await optimizeInput(input);
        }
        
        await new Promise(r => setTimeout(r, delayMs * 2));
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
  
  // Always show formatted score, defaulting to 0 if no score exists
  bestScoreEl.textContent = `Best EPS: $${(bestScore || 0).toFixed(2)}`;
  
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
    
    // Rest of the updateHistoryUI function remains the same...
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
    if (message.type === 'initialScore' || message.type === 'newScore' || message.type === 'newBestScore') {
      // Add to history
      globalHistory.push({
        score: message.score,
        combo: message.combo,
        timestamp: message.timestamp
      });

      // Update best score if new score is higher
      if (message.score > bestScore) {
        bestScore = message.score;
        bestComboGlobal = message.combo;
      }

      // Save state and update UI
      saveState();
      updateBestScoreDisplay();
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


