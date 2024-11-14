// popup.js
let isRunning = false;
let bestScore = 0;
let bestCombo = null;


async function loadState() {
  const state = await chrome.storage.local.get(['isRunning', 'bestScore', 'bestCombo']);
  isRunning = state.isRunning || false;
  bestScore = state.bestScore || 0;
  bestCombo = state.bestCombo || null;
  console.log("Loaded state:", { isRunning, bestScore, bestCombo });

  updateBestScoreDisplay();
}

// Reset state function
async function resetState() {
  bestScore = 0;
  bestCombo = null;
  await saveState();
  updateBestScoreDisplay();
}

// Update the best EPS display and show the Apply Values button if a best combo exists
function updateBestScoreDisplay() {
  const bestScoreEl = document.getElementById('bestScore');
  if (bestScoreEl) {
    bestScoreEl.innerHTML = `
      <div class="score-header">
        <span>Best EPS: $${(bestScore || 0).toFixed(2)}</span>
        ${bestCombo ? 
          `<button id="applyBestValues" class="apply-button">Apply Best Values</button>` : 
          ''}
        <button id="resetButton" class="reset-button">Reset</button>
      </div>
    `;

    // Add click handler for apply values button
    const applyBestButton = document.getElementById('applyBestValues');
    if (applyBestButton && bestCombo) {
      applyBestButton.addEventListener('click', async () => {
        try {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          if (!tab) {
            console.error('No active tab found');
            return;
          }
          
          await applyBestCombo(tab, bestCombo);
          
          // Visual feedback
          applyBestButton.textContent = 'Applied!';
          applyBestButton.style.backgroundColor = '#45a049';
          setTimeout(() => {
            applyBestButton.textContent = 'Apply Best Values';
            applyBestButton.style.backgroundColor = '#4CAF50';
          }, 1000);
        } catch (error) {
          console.error('Error applying best values:', error);
        }
      });
    }

    // Add click handler for reset button
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', async () => {
        try {
          await resetState();
          
          // Visual feedback
          resetButton.textContent = 'Reset!';
          resetButton.style.backgroundColor = '#ff6b6b';
          setTimeout(() => {
            resetButton.textContent = 'Reset Best';
            resetButton.style.backgroundColor = '#dc3545';
          }, 1000);
        } catch (error) {
          console.error('Error resetting state:', error);
        }
      });
    }
  }
}

async function saveState() {
  await chrome.storage.local.set({
    isRunning,
    bestScore,
    bestCombo
  });
  console.log("Saved state:", { isRunning, bestScore, bestCombo });
}

function applyBestCombo(tab, combo) {
  if (!combo) {
    console.error('No combo data to apply');
    return;
  }

  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (comboData) => {
      const setInputValue = (input, value) => {
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
      };

      const setSelectValue = (select, value) => {
        const options = Array.from(select.options);
        const index = options.findIndex(o => o.value === value);
        if (index !== -1 && select.selectedIndex !== index) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      const clickCalculate = () => {
        const buttons = Array.from(document.getElementsByTagName('button'));
        const calcBtn = buttons.find(b =>
          b.textContent.toLowerCase().includes('calculate') ||
          b.textContent.toLowerCase().includes('update scores')
        );
        if (calcBtn) {
          calcBtn.click();
          return true;
        }
        console.error('Calculate button not found');
        return false;
      };

      const inputs = document.querySelectorAll('input.input-field');
      const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');

      inputs.forEach(input => {
        const id = input.id || input.name;
        if (comboData[id] !== undefined) {
          setInputValue(input, comboData[id].value);
          console.log(`Set input ${id} to ${comboData[id].value}`);
        }
      });

      selects.forEach(select => {
        const id = select.id || select.name;
        if (comboData[id] !== undefined) {
          setSelectValue(select, comboData[id].value);
          console.log(`Set select ${id} to ${comboData[id].value}`);
        }
      });

      setTimeout(() => clickCalculate(), 100);
    },
    args: [combo]
  });
}
// Update best EPS if a new high score is achieved
async function handleNewScore(currentScore, currentCombo) {
  if (!currentScore || currentScore <= bestScore) return;

  bestScore = currentScore;
  bestCombo = JSON.parse(JSON.stringify(currentCombo));  // Ensure a deep copy
  console.log("New best EPS achieved:", bestScore);
  console.log("Best Combo Saved:", bestCombo);

  await saveState();
  updateBestScoreDisplay();
}




// Helper function to check if new metrics are better than existing ones
function shouldAddToHistory(newMetrics) {
  if (globalHistory.length === 0) return true;
  
  return globalHistory.some(entry => {
      if (!entry.metrics) return true;
      
      // Check if new metrics are better in any way
      return (newMetrics.cash > entry.metrics.cash ||
              newMetrics.netRevenue > entry.metrics.netRevenue ||
              newMetrics.profit > entry.metrics.profit) &&
             newMetrics.eps >= entry.metrics.eps;
  });
}


function injectOptimizer(tab, delay) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function(delayMs) {
      let isRunning = true;
      let lastScore = null;
      let lastMetrics = null;
      let bestScore = -Infinity;

      // Get all relevant metrics from the page
      function getMetrics() {
        const metrics = {
          eps: null,
          netRevenue: null,
          profit: null,
          cash: null,
          imageRating: null,
          marketShare: null,
          stockPrice: null,
          roa: null // Return on Assets
        };
        
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          const measureCell = row.querySelector('td.measure');
          if (!measureCell) continue;
          
          const scoreCell = row.querySelector('td.score.text-center');
          if (!scoreCell) continue;
          
          const measureText = measureCell.textContent.toLowerCase();
          const scoreText = scoreCell.textContent;
          
          // Extract numeric value from score text
          const numericValue = parseFloat(scoreText.replace(/[$,%]/g, ''));
          
          if (measureText.includes('earnings per share')) {
            metrics.eps = numericValue;
          } else if (measureText.includes('net revenues')) {
            metrics.netRevenue = numericValue;
          } else if (measureText.includes('net profit')) {
            metrics.profit = numericValue;
          } else if (measureText.includes('cash')) {
            metrics.cash = numericValue;
          } else if (measureText.includes('image rating')) {
            metrics.imageRating = numericValue;
          } else if (measureText.includes('market share')) {
            metrics.marketShare = numericValue;
          } else if (measureText.includes('stock price')) {
            metrics.stockPrice = numericValue;
          } else if (measureText.includes('return on assets')) {
            metrics.roa = numericValue;
          }
        }
        
        return metrics;
      }

      // Calculate weighted score based on all metrics
      function calculateCompositeScore(metrics) {
        if (!metrics.eps) return null;
        
        if (!window.bestMetrics) {
          window.bestMetrics = { ...metrics };
        }
        
        // Update best metrics
        Object.keys(metrics).forEach(key => {
          if (metrics[key] > window.bestMetrics[key]) {
            window.bestMetrics[key] = metrics[key];
          }
        });
        
        // Base score heavily weighted towards EPS
        let score = metrics.eps * 1000;
        
        // Helper function to calculate weighted improvements
        const calculateImprovement = (current, best, weight) => {
          if (current && best) {
            const improvement = (current - best) / best;
            return improvement > 0 ? improvement * weight : 0;
          }
          return 0;
        };
        
        // Add weighted contributions from other metrics
        score += calculateImprovement(metrics.netRevenue, window.bestMetrics.netRevenue, 50);
        score += calculateImprovement(metrics.profit, window.bestMetrics.profit, 40);
        score += calculateImprovement(metrics.cash, window.bestMetrics.cash, 30);
        score += calculateImprovement(metrics.imageRating, window.bestMetrics.imageRating, 20);
        score += calculateImprovement(metrics.marketShare, window.bestMetrics.marketShare, 25);
        score += calculateImprovement(metrics.stockPrice, window.bestMetrics.stockPrice, 35);
        score += calculateImprovement(metrics.roa, window.bestMetrics.roa, 25);
        
        return {
          compositeScore: score,
          metrics: metrics
        };
      }

      const constraints = {
  "N.A. Wholesale Price": { min: 75, max: 1000 },
  "E-A Wholesale Price": { min: 75, max: 1000 },
  "A-P Wholesale Price": { min: 75, max: 1000 },
  "L.A. Wholesale Price": { min: 75, max: 1000 },
  "N.A. Retailer Support Budget": { min: 0, max: 10000 },
  "E-A Retailer Support Budget": { min: 0, max: 10000 },
  "N.A. Website Product Displays/Info": { min: 0, max: 5000 },  // New constraint
  // Add more configurations as needed
};



      function setInputValue(input, value) {
        const label = input.getAttribute("title") || input.getAttribute("aria-label");
        const { min, max } = constraints[label] || { min: 0, max: 10000 }; // Default range if not specified

        // Clamp value within min and max constraints
        const clampedValue = Math.min(Math.max(value, min), max);

        if (input.value !== clampedValue.toFixed(2)) {
          input.value = clampedValue.toFixed(2);

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


      function setSelectValue(select, value) {
        const options = Array.from(select.options);
        const index = options.findIndex(o => o.value === value);
        
        if (index !== -1 && select.selectedIndex !== index) {
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

      function captureCurrentValues() {
        const currentCombo = {};
        const inputs = document.querySelectorAll('input.input-field');
        const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');
      
        inputs.forEach(input => {
          const id = input.id || input.name;
          if (id) {
            currentCombo[id] = {
              value: parseFloat(input.value) || 0,
              label: input.title || input.getAttribute('aria-label') || id
            };
          }
        });
      
        selects.forEach(select => {
          const id = select.id || select.name;
          if (id) {
            currentCombo[id] = {
              value: select.value,
              label: select.previousElementSibling?.textContent || id
            };
          }
        });
      
        console.log("Captured values for best EPS:", currentCombo);
        return currentCombo;
      }
      
      async function optimizeInput(input, globalState = { bestCombo: {}, bestEPS: 0 }, priceRange = { min: 400, max: 1000 }) {
        const label = input.getAttribute("title") || input.getAttribute("aria-label");
        const { min, max } = constraints[label] || priceRange;
      
        // Initialize with current value instead of midpoint
        let currentValue = parseFloat(input.value) || Math.round((min + max) / 2);
        let bestValue = currentValue;
        let bestEPS = globalState.bestEPS;  // Track best EPS locally
      
        // Get initial metrics before starting optimization
        await clickCalculate();
        await new Promise(r => setTimeout(r, 2000));
        const initialMetrics = getMetrics();
        
        // Initialize best EPS if needed
        if (bestEPS === 0 && initialMetrics.eps) {
          bestEPS = initialMetrics.eps;
          globalState.bestEPS = bestEPS;
          console.log(`Initializing best EPS to: ${bestEPS}`);
        }
      
        const increments = [100, 50, 25, 10, 5, 1];
        console.log(`Starting optimization for ${label} with initial EPS: ${initialMetrics.eps}, Best EPS: ${bestEPS}`);
      
        // Loop through each increment level
        for (let increment of increments) {
          let isImproving = true;
          let noImprovementCount = 0;
          const maxNoImprovement = 3;
      
          while (isImproving && noImprovementCount < maxNoImprovement) {
            let foundImprovement = false;
      
            for (let direction of [-1, 1]) {
              const newValue = Math.max(min, Math.min(max, currentValue + direction * increment));
              const roundedValue = Math.round(newValue);
      
              if (roundedValue === currentValue) continue;
      
              // Apply the value and get new metrics
              setInputValue(input, roundedValue);
              await clickCalculate();
              await new Promise(r => setTimeout(r, 2000));
      
              const currentMetrics = getMetrics();
              
              if (!currentMetrics.eps) {
                console.log(`Warning: No EPS value returned for ${label} at ${roundedValue}`);
                continue;
              }
      
              console.log(`Trying ${label} at ${roundedValue}, EPS: ${currentMetrics.eps}, Current Best: ${bestEPS}`);
      
              if (currentMetrics.eps > bestEPS) {
                bestEPS = currentMetrics.eps;
                bestValue = roundedValue;
                currentValue = roundedValue;
                foundImprovement = true;
      
                // Update global state
                globalState.bestEPS = bestEPS;
                globalState.bestCombo = {
                  ...globalState.bestCombo,
                  [label]: bestValue
                };
                
                console.log(`New best EPS found: ${bestEPS} at ${label} = ${bestValue}`);
                break;
              }
            }
      
            if (!foundImprovement) {
              noImprovementCount++;
            } else {
              noImprovementCount = 0;
            }
      
            isImproving = foundImprovement;
          }
        }
      
        // Return to best value before finishing
        if (bestValue !== parseFloat(input.value)) {
          setInputValue(input, bestValue);
          await clickCalculate();
          await new Promise(r => setTimeout(r, 2000));
        }
      
        console.log(`Optimization complete for ${label}. Final best EPS: ${bestEPS}`);
        
        // Return updated global state
        return {
          bestCombo: globalState.bestCombo,
          bestEPS: bestEPS
        };
      }
      
      // Main optimize function
      async function optimize() {
        let globalState = {
          bestCombo: {},
          bestEPS: 0
        };
      
        while (isRunning) {
          // Get initial EPS
          await clickCalculate();
          await new Promise(r => setTimeout(r, 2000));
          const initialMetrics = getMetrics();
          
          if (globalState.bestEPS === 0 && initialMetrics.eps) {
            globalState.bestEPS = initialMetrics.eps;
          }
          
          console.log(`Starting optimization run with best EPS: ${globalState.bestEPS}`);
          
          // Optimize input fields
          const inputs = document.querySelectorAll('input.input-field');
          for (const input of inputs) {
            if (!isRunning) break;
            
            // Ensure we're using best known values
            applyBestGlobalValues(globalState.bestCombo);
            await clickCalculate();
            await new Promise(r => setTimeout(r, 2000));
            
            const result = await optimizeInput(input, globalState);
            globalState = result;  // Update global state with results
            
            console.log(`After optimizing input, best EPS: ${globalState.bestEPS}`);
          }
          
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      // Helper function to apply best values
      function applyBestGlobalValues(bestGlobalCombo) {
        console.log('Applying best global values:', bestGlobalCombo);
        
        for (const [label, value] of Object.entries(bestGlobalCombo)) {
          const inputs = document.querySelectorAll('input.input-field');
          inputs.forEach(input => {
            const inputLabel = input.getAttribute("title") || input.getAttribute("aria-label");
            if (inputLabel === label) {
              setInputValue(input, value);
              console.log(`Applied ${value} to ${label}`);
            }
          });
        }
      }
      
      // Main optimize function that maintains global state
      async function optimize() {
        const globalState = {
          bestCombo: {},
          bestEPS: 0
        };
      
        while (isRunning) {
          // First get initial EPS
          await clickCalculate();
          await new Promise(r => setTimeout(r, 2000));
          const initialMetrics = getMetrics();
          
          // Only initialize bestEPS if it's the first run
          if (globalState.bestEPS === 0) {
            globalState.bestEPS = initialMetrics.eps || 0;
          }
          
          console.log(`Starting optimization run with global best EPS: ${globalState.bestEPS}`);
          
          // Optimize input fields
          const inputs = document.querySelectorAll('input.input-field');
          for (const input of inputs) {
            if (!isRunning) break;
            
            // Before optimizing each input, ensure we're using the best known combination
            if (Object.keys(globalState.bestCombo).length > 0) {
              applyBestGlobalValues(globalState.bestCombo);
              await clickCalculate();
              await new Promise(r => setTimeout(r, 2000));
            }
            
            const result = await optimizeInput(input, globalState);
            // Update global state with results
            globalState.bestCombo = { ...globalState.bestCombo, ...result.bestCombo };
            globalState.bestEPS = Math.max(globalState.bestEPS, result.bestEPS);
            
            console.log(`After optimizing input, global best EPS: ${globalState.bestEPS}`);
          }
          
          await new Promise(r => setTimeout(r, delayMs * 2));
        }
      }
      
      // Helper function to apply the best-known values across inputs
      function applyBestGlobalValues(bestGlobalCombo) {
        for (const [label, value] of Object.entries(bestGlobalCombo)) {
          const inputs = document.querySelectorAll('input.input-field');
          inputs.forEach(input => {
            const inputLabel = input.getAttribute("title") || input.getAttribute("aria-label");
            if (inputLabel === label) {
              setInputValue(input, value);
            }
          });
        }
      }


      async function optimizeSelect(select) {
        if (select.classList.contains('entry-assumptions-select')) {
          return null;
        }

        let bestOption = null;
        let bestScore = -Infinity;
        let bestMetricsFound = null;
        const options = Array.from(select.options);
        
        for (const option of options) {
          setSelectValue(select, option.value);
          await clickCalculate();
          await new Promise(r => setTimeout(r, delayMs));
          
          const currentMetrics = getMetrics();
          const currentScore = calculateCompositeScore(currentMetrics);
          
          if (currentScore.compositeScore > bestScore) {
            bestScore = currentScore.compositeScore;
            bestOption = option;
            bestMetricsFound = currentMetrics;
            
            chrome.runtime.sendMessage({
              type: 'newBestScore',
              score: currentMetrics.eps,
              metrics: currentMetrics,
              combo: captureCurrentValues(),
              timestamp: new Date().toLocaleTimeString()
            });
          }
        }
        
        if (bestOption) {
          setSelectValue(select, bestOption.value);
          await clickCalculate();
        }
        
        return { score: bestScore, metrics: bestMetricsFound };
      }

      async function optimize() {
        while (isRunning) {
          // Optimize select fields
          const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');
          for (const select of selects) {
            if (!isRunning) break;
            await optimizeSelect(select);
          }
          
          // Optimize input fields
          const inputs = document.querySelectorAll('input.input-field');
          for (const input of inputs) {
            if (!isRunning) break;
            await optimizeInput(input);
          }
          
          await new Promise(r => setTimeout(r, delayMs * 2));
        }
      }

      // Set up mutation observer to track changes
      const observer = new MutationObserver(() => {
        const currentMetrics = getMetrics();
        const currentScore = calculateCompositeScore(currentMetrics);
        
        if (currentScore && (!lastScore || currentScore.compositeScore > lastScore.compositeScore)) {
          lastScore = currentScore;
          lastMetrics = currentMetrics;
          
          chrome.runtime.sendMessage({
            type: 'newScore',
            score: currentMetrics.eps,
            metrics: currentMetrics,
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

      // Capture and send initial state
      const initialMetrics = getMetrics();
      if (initialMetrics.eps !== null) {
        chrome.runtime.sendMessage({
          type: 'initialScore',
          score: initialMetrics.eps,
          metrics: initialMetrics,
          combo: captureCurrentValues(),
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // Start optimization
      optimize();
      
      // Cleanup function
      window.stopOptimizer = () => { 
        isRunning = false;
        observer.disconnect();
      };
      
      // Function to apply historical combinations
      window.applyCombo = function(combo) {
        const inputs = document.querySelectorAll('input[type="number"], input[formcontrolname]');
        const selects = document.querySelectorAll('select');
        
        inputs.forEach(input => {
          const id = input.id || input.name;
          if (combo[id]) {
            setInputValue(input, combo[id].value);
          }
        });
        
        selects.forEach(select => {
          const id = select.id || select.name;
          if (combo[id]) {
            setSelectValue(select, combo[id].value);
          }
        });
        
        setTimeout(() => clickCalculate(), 100);
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

// Update the function that applies values to the page
function applyHistoryCombo(tab, combo) {
  if (!combo) {
    console.error('No combo data to apply');
    return;
  }

  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (comboData) => {
      // Function to set input value and trigger all necessary events
      const setInputValue = (input, value) => {
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
      };

      // Function to set select value and trigger events
      const setSelectValue = (select, value) => {
        const options = Array.from(select.options);
        const index = options.findIndex(o => o.value === value);
        if (index !== -1 && select.selectedIndex !== index) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      // Function to click calculate button
      const clickCalculate = () => {
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
      };

      // Apply all values
      const inputs = document.querySelectorAll('input.input-field');
      const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');

      inputs.forEach(input => {
        const id = input.id || input.name;
        if (comboData[id]) {
          setInputValue(input, comboData[id].value);
        }
      });

      selects.forEach(select => {
        const id = select.id || select.name;
        if (comboData[id]) {
          setSelectValue(select, comboData[id].value);
        }
      });

      // Click calculate button after a short delay to ensure all values are set
      setTimeout(() => clickCalculate(), 100);
    },
    args: [combo]
  });
}

// Modify updateHistoryUI to include an apply best button
function updateHistoryUI() {
  const historyContainer = document.getElementById('history');
  const bestScoreEl = document.getElementById('bestScore');

  if (!historyContainer || !bestScoreEl) return;
  
  // Update best score display
  bestScoreEl.innerHTML = `
      Best EPS: $${(bestScore || 0).toFixed(2)}
      ${globalBestCombo ? '<button id="applyBest" class="apply-button">Apply Best</button>' : ''}
  `;
  
  // Add click handler for apply best button
  const applyBestButton = document.getElementById('applyBest');
  if (applyBestButton && globalBestCombo) {
      applyBestButton.addEventListener('click', async () => {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          applyHistoryCombo(tab, globalBestCombo);
      });
  }
  
  // Update history list
  historyContainer.innerHTML = '';
  globalHistory.slice().reverse().forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const scoreInfo = document.createElement('div');
      scoreInfo.className = 'score-info';
      
      // Include metrics in the display if available
      const metricsDisplay = entry.metrics ? `
          <div class="metrics-info">
              Cash: $${entry.metrics.cash?.toFixed(2) || 0}
              Revenue: $${entry.metrics.netRevenue?.toFixed(2) || 0}
              Profit: $${entry.metrics.profit?.toFixed(2) || 0}
          </div>
      ` : '';
      
      scoreInfo.innerHTML = `
          <div class="score-header">
              <span class="timestamp">${entry.timestamp}</span>
              <span class="score">EPS: $${entry.score.toFixed(2)}</span>
              ${metricsDisplay}
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
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  await loadState();

  const style = document.createElement('style');

  if (isRunning) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }

  style.textContent = `

  .reset-button {
      padding: 4px 8px;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-left: 8px;
    }
    .reset-button:hover {
      background-color: #c82333;
    }
  
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
    if (message.type === 'newBestScore') {
      handleNewScore(message.score, message.combo);
    }
  });

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const delay = parseInt(document.getElementById('delay').value) || 2000;

    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';

    await saveState();
    injectOptimizer(tab, delay);
  });


  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';

    isRunning = false;
    await saveState();
    stopOptimizer(tab);
  });
});