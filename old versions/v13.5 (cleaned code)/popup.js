let isRunning = false, bestScore = 0, bestCombo = null;

async function loadState() {
  const state = await chrome.storage.local.get(['isRunning', 'bestScore', 'bestCombo']);
  ({ isRunning = false, bestScore = 0, bestCombo = null } = state);
  console.log("Loaded state:", { isRunning, bestScore, bestCombo });
  updateBestScoreDisplay();
}

async function resetState() {
  bestScore = 0; bestCombo = null;
  await saveState();
  updateBestScoreDisplay();
}

function updateBestScoreDisplay() {
  const bestScoreEl = document.getElementById('bestScore');
  if (bestScoreEl) {
    bestScoreEl.innerHTML = `
      <div class="score-header">
        <span>Best EPS: $${(bestScore || 0).toFixed(2)}</span>
        ${bestCombo ? `<button id="applyBestValues" class="apply-button">Apply Best Values</button>` : ''}
        <button id="resetButton" class="reset-button">Reset</button>
      </div>
    `;

    const applyBestButton = document.getElementById('applyBestValues');
    if (applyBestButton && bestCombo) {
      applyBestButton.addEventListener('click', async () => {
        try {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          await applyBestCombo(tab, bestCombo);
          applyBestButton.textContent = 'Applied!';
          applyBestButton.style.backgroundColor = '#45a049';
          setTimeout(() => {
            applyBestButton.textContent = 'Apply Best Values';
            applyBestButton.style.backgroundColor = '#4CAF50';
          }, 2);
        } catch (error) {
          console.error('Error applying best values:', error);
        }
      });
    }

    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', async () => {
        try {
          await resetState();
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
  await chrome.storage.local.set({ isRunning, bestScore, bestCombo });
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
          ['input', 'change', 'blur'].forEach(eventType => input.dispatchEvent(new Event(eventType, { bubbles: true })));
          ['keydown', 'keyup'].forEach(eventType => input.dispatchEvent(new KeyboardEvent(eventType, { key: 'Enter', keyCode: 13, bubbles: true })));
        }
      };

      const setSelectValue = (select, value) => {
        const index = Array.from(select.options).findIndex(o => o.value === value);
        if (index !== -1 && select.selectedIndex !== index) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      const clickCalculate = () => {
        const calcBtn = Array.from(document.getElementsByTagName('button')).find(b =>
          b.textContent.toLowerCase().includes('calculate') || b.textContent.toLowerCase().includes('update scores')
        );
        return calcBtn ? (calcBtn.click(), true) : (console.error('Calculate button not found'), false);
      };

      document.querySelectorAll('input.input-field').forEach(input => {
        const id = input.id || input.name;
        if (comboData[id] !== undefined) setInputValue(input, comboData[id].value);
      });

      document.querySelectorAll('select:not(.entry-assumptions-select)').forEach(select => {
        const id = select.id || select.name;
        if (comboData[id] !== undefined) setSelectValue(select, comboData[id].value);
      });

      setTimeout(clickCalculate, 100);
    },
    args: [combo]
  });
}

async function handleNewScore(currentScore, currentCombo) {
  if (!currentScore || isNaN(currentScore)) return;
  
  if (currentScore > bestScore) {
    bestScore = currentScore;
    bestCombo = JSON.parse(JSON.stringify(currentCombo));
    
    console.log("New best EPS achieved:", bestScore);
    console.log("Best Combo Saved:", bestCombo);
    
    await saveState();
    updateBestScoreDisplay();
  }
}

function shouldAddToHistory(newMetrics) {
  return globalHistory.length === 0 || globalHistory.some(entry => 
    !entry.metrics || 
    ((newMetrics.cash > entry.metrics.cash || 
      newMetrics.netRevenue > entry.metrics.netRevenue || 
      newMetrics.profit > entry.metrics.profit) && 
     newMetrics.eps >= entry.metrics.eps)
  );
}
function injectOptimizer(tab, delay) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function(delayMs) {
      let isRunning = true, lastScore = null, lastMetrics = null, bestScore = -Infinity;

      const getMetrics = () => {
        const metrics = { eps: null, netRevenue: null, profit: null, cash: null, imageRating: null, marketShare: null, stockPrice: null, roa: null };
        document.querySelectorAll('tr').forEach(row => {
          const measureCell = row.querySelector('td.measure');
          const scoreCell = row.querySelector('td.score.text-center');
          if (!measureCell || !scoreCell) return;

          const measureText = measureCell.textContent.toLowerCase();
          const numericValue = parseFloat(scoreCell.textContent.replace(/[$,%]/g, ''));

          const metricMap = {
            'earnings per share': 'eps',
            'net revenues': 'netRevenue',
            'net profit': 'profit',
            'cash': 'cash',
            'image rating': 'imageRating',
            'market share': 'marketShare',
            'stock price': 'stockPrice',
            'return on assets': 'roa'
          };

          Object.entries(metricMap).forEach(([key, metric]) => {
            if (measureText.includes(key)) metrics[metric] = numericValue;
          });
        });
        return metrics;
      };

      const calculateCompositeScore = (metrics) => {
        if (!metrics || !metrics.eps || metrics.eps <= 0) return null;

        window.bestMetrics = window.bestMetrics || { ...metrics };
        Object.keys(metrics).forEach(key => {
          if (metrics[key] > window.bestMetrics[key]) {
            window.bestMetrics[key] = metrics[key];
          }
        });

        const calculateImprovement = (current, best, weight) => 
          current && best ? Math.max((current - best) / best * weight, 0) : 0;
        let score = metrics.eps * 1000;
        ['netRevenue', 'profit', 'cash', 'imageRating', 'marketShare', 'stockPrice', 'roa']
          .forEach((metric, index) => {
            const weights = [50, 40, 30, 20, 25, 35, 25];
            score += calculateImprovement(metrics[metric], window.bestMetrics[metric], weights[index]);
          });

        return { compositeScore: score, metrics };
      };

      const acCameraConstraints = {
        "N.A. Wholesale Price": { min: 75, max: 1000, increment: [0,5,10,25] },
        "E-A Wholesale Price": { min: 75, max: 1000, increment: [0,5,10,25] },
        "A-P Wholesale Price": { min: 75, max: 1000, increment: [0,5,10,25] },
        "L.A. Wholesale Price": { min: 75, max: 1000, increment: [0,5,10,25] },
        "N.A. Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "E-A Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "A-P Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "L.A. Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "N.A. Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "E-A Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "A-P Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "L.A. Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "N.A. Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "E-A Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "A-P Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "L.A. Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] }
      };
      const uavDroneConstraints = {
        "N.A. Retail Price": { min: 500, max: 5000, increment: 25 },
        "E-A Retail Price": { min: 500, max: 5000, increment: 25 },
        "A-P Retail Price": { min: 500, max: 5000, increment: 25 },
        "L.A. Retail Price": { min: 500, max: 5000, increment: 25 },
        "N.A. Average Retail Price": { min: 500, max: 5000, increment: 25 },
        "E-A Average Retail Price": { min: 500, max: 5000, increment: 25 },
        "A-P Average Retail Price": { min: 500, max: 5000, increment: 25 },
        "L.A. Average Retail Price": { min: 500, max: 5000, increment: 25 },
        "N.A. Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "E-A Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "A-P Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "L.A. Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] },
        "N.A. Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10500, 12000, 13500, 15000] },
        "E-A Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10500, 12000, 13500, 15000] },
        "A-P Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10500, 12000, 13500, 15000] },
        "L.A. Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10500, 12000, 13500, 15000] },
        "N.A. Retailer Recruitment/Support Budget": { min: 0, max: 10000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "E-A Retailer Recruitment/Support Budget": { min: 0, max: 10000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "A-P Retailer Recruitment/Support Budget": { min: 0, max: 10000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] },
        "L.A. Retailer Recruitment/Support Budget": { min: 0, max: 10000, initialSteps: [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000] }
      };

      const detectProduct = () => {
        const inputs = document.querySelectorAll('input.input-field');
        for (const input of inputs) {
          const label = input.getAttribute("title") || input.getAttribute("aria-label");
          if (!label) continue;
          if (label.includes('Wholesale Price')) return "acCamera";
          if (label.includes('Retail Price')) return "uavDrone";
        }
        return null;
      };

      const setInputValue = (input, value) => {
        const label = input.getAttribute("title") || input.getAttribute("aria-label");
        if (!label) return;

        const product = detectProduct();
        const constraints = (product === "acCamera" ? acCameraConstraints : uavDroneConstraints)[label];
        
        if (!constraints) {
          console.log(`No constraints found for label: ${label}`);
          return;
        }

        const clampedValue = Math.min(Math.max(value, constraints.min), constraints.max);
        
        if (input.value !== clampedValue.toString()) {
          input.value = clampedValue.toFixed(2);
          ['input', 'change', 'blur'].forEach(type => 
            input.dispatchEvent(new Event(type, { bubbles: true }))
          );
          ['keydown', 'keyup'].forEach(type => 
            input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', keyCode: 13, bubbles: true }))
          );
        }
      };

      const setSelectValue = (select, value) => {
        const index = Array.from(select.options).findIndex(o => o.value === value);
        if (index !== -1 && select.selectedIndex !== index) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      const clickCalculate = () => {
        const calcBtn = Array.from(document.getElementsByTagName('button')).find(b => 
          b.textContent.toLowerCase().includes('calculate') || 
          b.textContent.toLowerCase().includes('update scores')
        );
        return calcBtn ? (calcBtn.click(), true) : false;
      };

      const captureCurrentValues = () => {
        const currentCombo = {};
        document.querySelectorAll('input.input-field, select:not(.entry-assumptions-select)').forEach(el => {
          const id = el.id || el.name;
          if (id) {
            currentCombo[id] = {
              value: el instanceof HTMLInputElement ? parseFloat(el.value) || 0 : el.value,
              label: el.title || el.getAttribute('aria-label') || id
            };
          }
        });
        return currentCombo;
      };

      async function optimizeInput(input, globalState = { bestCombo: {}, bestEPS: 0 }) {
        const label = input.getAttribute("title") || input.getAttribute("aria-label");
        const product = detectProduct();
        const inputConstraints = (product === "acCamera" ? acCameraConstraints : uavDroneConstraints)[label];
      
        if (!inputConstraints) {
          console.log(`No constraints found for label: ${label}`);
          return globalState;
        }
      
        let bestValue = parseFloat(input.value) || 0;
        let bestEPS = globalState.bestEPS;
      
        const needsBroadSweep = ['budget', 'displays', 'advertising'].some(type => label.toLowerCase().includes(type));
      
        const performSearch = async (searchValues, searchType = 'fine') => {
          let localBestEPS = bestEPS;
          let localBestValue = bestValue;
      
          for (const testValue of searchValues) {
            setInputValue(input, testValue);
            await clickCalculate();
            await new Promise(r => setTimeout(r, 2));
      
            const currentMetrics = getMetrics();
            
            // Only update if EPS is strictly greater
            if (currentMetrics.eps > localBestEPS) {
              localBestEPS = currentMetrics.eps;
              localBestValue = testValue;
              
              console.log(`New best found during ${searchType} search: ${label} = ${testValue}, EPS = ${localBestEPS}`);
              
              // Update global best if local best is better
              if (localBestEPS > bestEPS) {
                bestEPS = localBestEPS;
                bestValue = localBestValue;
                
                // Send message about new best score
                chrome.runtime.sendMessage({
                  type: 'newBestScore',
                  score: bestEPS,
                  metrics: currentMetrics,
                  combo: captureCurrentValues(),
                  timestamp: new Date().toLocaleTimeString()
                });
              }
            }
          }
      
          return { bestValue: localBestValue, bestEPS: localBestEPS };
        };
      
        // Broad sweep for budget-like inputs
        if (needsBroadSweep && inputConstraints.initialSteps) {
          console.log(`Starting broad sweep for ${label}`);
          const broadResult = await performSearch(inputConstraints.initialSteps, 'broad');
          bestValue = broadResult.bestValue;
          bestEPS = broadResult.bestEPS;
      
          // Fine search around the best broad sweep value
          const searchRadius = label.includes("Website") ? 500 : 1000;
          const increment = label.includes("Website") ? 100 : 250;
          const searchMin = Math.max(inputConstraints.min, bestValue - searchRadius);
          const searchMax = Math.min(inputConstraints.max, bestValue + searchRadius);
          
          const fineSearchValues = Array.from(
            { length: Math.floor((searchMax - searchMin) / increment) + 1 },
            (_, i) => searchMin + i * increment
          );
          
          const fineResult = await performSearch(fineSearchValues, 'fine');
          bestValue = fineResult.bestValue;
          bestEPS = fineResult.bestEPS;
        } 
        // More granular search for other inputs
        else {
          const increments = [100, 50, 25, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
          let localBestEPS = bestEPS;
          let localBestValue = bestValue;
      
          for (const increment of increments) {
            let isImproving = true;
            while (isImproving) {
              isImproving = false;
      
              for (const direction of [-1, 1]) {
                const newValue = Math.max(
                  inputConstraints.min,
                  Math.min(inputConstraints.max, localBestValue + direction * increment)
                );
      
                if (newValue === localBestValue) continue;
      
                setInputValue(input, newValue);
                await clickCalculate();
                await new Promise(r => setTimeout(r, 2));
      
                const currentMetrics = getMetrics();
                if (currentMetrics.eps > localBestEPS) {
                  localBestEPS = currentMetrics.eps;
                  localBestValue = newValue;
                  isImproving = true;
      
                  // Update global best if local best is better
                  if (localBestEPS > bestEPS) {
                    bestEPS = localBestEPS;
                    bestValue = localBestValue;
                    
                    chrome.runtime.sendMessage({
                      type: 'newBestScore',
                      score: bestEPS,
                      metrics: currentMetrics,
                      combo: captureCurrentValues(),
                      timestamp: new Date().toLocaleTimeString()
                    });
                  }
      
                  break;
                }
              }
            }
          }
      
          bestValue = localBestValue;
          bestEPS = localBestEPS;
        }
      
        // Set the best value found
        setInputValue(input, bestValue);
        await clickCalculate();
        await new Promise(r => setTimeout(r, 2));
      
        return {
          bestCombo: { ...globalState.bestCombo, [label]: bestValue },
          bestEPS
        };
      }
      
      
      
      function applyBestGlobalValues(bestGlobalCombo) {
        console.log('Applying best global values:', bestGlobalCombo);
        
        document.querySelectorAll('input.input-field').forEach(input => {
          const inputLabel = input.getAttribute("title") || input.getAttribute("aria-label");
          if (bestGlobalCombo[inputLabel] !== undefined) {
            setInputValue(input, bestGlobalCombo[inputLabel]);
            console.log(`Applied ${bestGlobalCombo[inputLabel]} to ${inputLabel}`);
          }
        });
      }
      
      async function optimize() {
        const globalState = {
          bestCombo: {},
          bestEPS: 0,
          bestMetrics: null,
          lastImprovement: Date.now()
        };
      
        const isStagnant = () => Date.now() - globalState.lastImprovement > 300000;
      
        const updateGlobalState = (metrics, combo) => {
          globalState.bestEPS = metrics.eps;
          globalState.bestMetrics = metrics;
          globalState.bestCombo = combo;
          globalState.lastImprovement = Date.now();
      
          chrome.runtime.sendMessage({
            type: 'newBestScore',
            score: metrics.eps,
            metrics,
            combo,
            timestamp: new Date().toLocaleTimeString()
          });
        };
      
        while (isRunning) {
          if (Object.keys(globalState.bestCombo).length > 0) {
            applyBestGlobalValues(globalState.bestCombo);
            await clickCalculate();
            await new Promise(r => setTimeout(r, 2));
          }
      
          const currentMetrics = getMetrics();
          if (currentMetrics.eps > globalState.bestEPS) {
            updateGlobalState(currentMetrics, captureCurrentValues());
          }
      
          const strategies = [
            { type: 'price', range: { min: 75, max: 1000 }, increment: 25 },
            { type: 'marketing', range: { min: 0, max: 10000 }, increment: 500 },
            { type: 'production', range: { min: 0, max: 5000 }, increment: 250 }
          ];
      
          const inputs = document.querySelectorAll('input.input-field');
          for (const input of inputs) {
            if (!isRunning) break;
      
            const label = input.getAttribute("title") || input.getAttribute("aria-label");
            const strategy = getStrategyForInput(label, strategies);
            if (!strategy) continue;
      
            let localBestValue = parseFloat(input.value);
            let localBestEPS = currentMetrics.eps;
      
            for (const direction of [-1, 1]) {
              let currentValue = localBestValue;
              let noImprovementCount = 0;
      
              while (noImprovementCount < 3) {
                const newValue = Math.max(
                  strategy.range.min,
                  Math.min(strategy.range.max, currentValue + direction * strategy.increment)
                );
      
                if (newValue === currentValue) break;
      
                setInputValue(input, newValue);
                await clickCalculate();
                await new Promise(r => setTimeout(r, 2));
      
                const newMetrics = getMetrics();
                if (newMetrics.eps > localBestEPS) {
                  localBestValue = newValue;
                  localBestEPS = newMetrics.eps;
                  currentValue = newValue;
                  noImprovementCount = 0;
      
                  if (newMetrics.eps > globalState.bestEPS) {
                    updateGlobalState(newMetrics, captureCurrentValues());
                  }
                } else {
                  noImprovementCount++;
                  currentValue = newValue;
                }
              }
            }
      
            if (parseFloat(input.value) !== localBestValue) {
              setInputValue(input, localBestValue);
              await clickCalculate();
              await new Promise(r => setTimeout(r, 2));
            }
          }
      
          if (isStagnant()) {
            await randomizedSearch(globalState);
          }
      
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      
      function getStrategyForInput(label, strategies) {
        const strategyMap = {
          'price': 'price',
          'budget': 'marketing',
          'advertising': 'marketing',
          'support': 'marketing',
          'displays': 'production',
          'website': 'production',
          'production': 'production'
        };
      
        const matchedType = Object.entries(strategyMap).find(([key]) => 
          label.toLowerCase().includes(key)
        );
      
        return matchedType 
          ? strategies.find(s => s.type === matchedType[1]) 
          : null;
      }
      async function randomizedSearch(globalState) {
        const inputs = document.querySelectorAll('input.input-field');
        const strategies = [
          { type: 'price', range: { min: 75, max: 1000 } },
          { type: 'marketing', range: { min: 0, max: 10000 } },
          { type: 'production', range: { min: 0, max: 5000 } }
        ];
      
        for (let attempt = 0; attempt < 10 && isRunning; attempt++) {
          inputs.forEach(input => {
            const label = input.getAttribute("title") || input.getAttribute("aria-label");
            const strategy = getStrategyForInput(label, strategies);
      
            if (strategy) {
              const range = strategy.range.max - strategy.range.min;
              const randomValue = strategy.range.min + Math.random() * range;
              setInputValue(input, randomValue);
            }
          });
      
          await clickCalculate();
          await new Promise(r => setTimeout(r, 2000));
      
          const newMetrics = getMetrics();
          if (newMetrics.eps > globalState.bestEPS) {
            globalState.bestEPS = newMetrics.eps;
            globalState.bestMetrics = newMetrics;
            globalState.bestCombo = captureCurrentValues();
            globalState.lastImprovement = Date.now();
      
            chrome.runtime.sendMessage({
              type: 'newBestScore',
              score: newMetrics.eps,
              metrics: newMetrics,
              combo: globalState.bestCombo,
              timestamp: new Date().toLocaleTimeString()
            });
      
            return;
          }
        }
      
        applyBestGlobalValues(globalState.bestCombo);
        await clickCalculate();
      }
      
      function applyBestGlobalValues(bestGlobalCombo) {
        console.log('Applying best global values:', bestGlobalCombo);
        
        document.querySelectorAll('input.input-field').forEach(input => {
          const inputLabel = input.getAttribute("title") || input.getAttribute("aria-label");
          if (bestGlobalCombo[inputLabel] !== undefined) {
            setInputValue(input, bestGlobalCombo[inputLabel]);
          }
        });
      }
      
      async function optimizeSelect(select) {
        if (select.classList.contains('entry-assumptions-select')) return null;
      
        let bestOption = null;
        let bestScore = -Infinity;
        let bestMetricsFound = null;
      
        for (const option of select.options) {
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
          const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');
          for (const select of selects) {
            if (!isRunning) break;
            await optimizeSelect(select);
          }
      
          const inputs = document.querySelectorAll('input.input-field');
          for (const input of inputs) {
            if (!isRunning) break;
            await optimizeInput(input);
          }
      
          await new Promise(r => setTimeout(r, delayMs * 2));
        }
      }
      
      // Mutation observer setup
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
      
      // Initial state capture
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
      
      // Apply historical combinations
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
    func: () => window.stopOptimizer && window.stopOptimizer()
  });
  isRunning = false;
  saveState();
}

function applyHistoryCombo(tab, combo) {
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
          ['input', 'change', 'blur'].forEach(eventType => 
            input.dispatchEvent(new Event(eventType, { bubbles: true }))
          );
          ['keydown', 'keyup'].forEach(eventType => 
            input.dispatchEvent(new KeyboardEvent(eventType, { 
              key: 'Enter', 
              keyCode: 13, 
              bubbles: true 
            }))
          );
        }
      };

      const setSelectValue = (select, value) => {
        const index = Array.from(select.options).findIndex(o => o.value === value);
        if (index !== -1 && select.selectedIndex !== index) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      const clickCalculate = () => {
        const calcBtn = Array.from(document.getElementsByTagName('button'))
          .find(b => 
            b.textContent.toLowerCase().includes('calculate') || 
            b.textContent.toLowerCase().includes('update scores')
          );
        return calcBtn ? (calcBtn.click(), true) : false;
      };

      const inputs = document.querySelectorAll('input.input-field');
      const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');

      inputs.forEach(input => {
        const id = input.id || input.name;
        if (comboData[id]) setInputValue(input, comboData[id].value);
      });

      selects.forEach(select => {
        const id = select.id || select.name;
        if (comboData[id]) setSelectValue(select, comboData[id].value);
      });

      setTimeout(clickCalculate, 100);
    },
    args: [combo]
  });
}

function updateHistoryUI() {
  const historyContainer = document.getElementById('history');
  const bestScoreEl = document.getElementById('bestScore');
  
  if (!historyContainer || !bestScoreEl) return;

  bestScoreEl.innerHTML = `
    Best EPS: $${(bestScore || 0).toFixed(2)}
    ${globalBestCombo ? '<button id="applyBest" class="apply-button">Apply Best</button>' : ''}
  `;

  const applyBestButton = document.getElementById('applyBest');
  if (applyBestButton && globalBestCombo) {
    applyBestButton.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      applyHistoryCombo(tab, globalBestCombo);
    });
  }

  historyContainer.innerHTML = '';

  globalHistory.slice().reverse().forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const scoreInfo = document.createElement('div');
    scoreInfo.className = 'score-info';

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
      
      Object.entries(entry.combo).forEach(([id, info]) => {
        details.innerHTML += `
          <div class="detail-item">
            <span class="detail-label">${info.label}:</span>
            <span class="detail-value">${info.value}</span>
          </div>
        `;
      });

      item.appendChild(scoreInfo);
      item.appendChild(details);

      scoreInfo.addEventListener('click', (e) => {
        if (!e.target.classList.contains('apply-button')) {
          details.style.display = details.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    historyContainer.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  await loadState();

  const updateButtonVisibility = () => {
    startBtn.style.display = isRunning ? 'none' : 'block';
    stopBtn.style.display = isRunning ? 'block' : 'none';
  };
  updateButtonVisibility();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'newBestScore') {
      handleNewScore(message.score, message.combo);
    }
  });

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const delay = parseInt(document.getElementById('delay').value) || 2000;
    
    isRunning = true;
    updateButtonVisibility();
    
    await saveState();
    injectOptimizer(tab, delay);
  });

  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    isRunning = false;
    updateButtonVisibility();
    
    await saveState();
    stopOptimizer(tab);
  });
});
