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

      // Split constraints into separate objects for each product
const acCameraConstraints = {
  "N.A. Wholesale Price": { min: 75, max: 1000, increment: 25 },
  "E-A Wholesale Price": { min: 75, max: 1000, increment: 25 },
  "A-P Wholesale Price": { min: 75, max: 1000, increment: 25 },
  "L.A. Wholesale Price": { min: 75, max: 1000, increment: 25 },

  "N.A. Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "E-A Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "A-P Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "L.A. Retailer Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },

  "N.A. Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "E-A Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "A-P Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "L.A. Advertising Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },

  "N.A. Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },
  "E-A Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },
  "A-P Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },
  "L.A. Website Product Displays/Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] }
};

const uavDroneConstraints = {
  "N.A. Average Retail Price": { min: 500, max: 5000, increment: 50 },
  "E-A Average Retail Price": { min: 500, max: 5000, increment: 50 },
  "A-P Average Retail Price": { min: 500, max: 5000, increment: 50 },
  "L.A. Average Retail Price": { min: 500, max: 5000, increment: 50 },

  "N.A. Website Product Displays / Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },
  "E-A Website Product Displays / Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },
  "A-P Website Product Displays / Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },
  "L.A. Website Product Displays / Info": { min: 0, max: 5000, initialSteps: [0, 500, 1000, 2000, 3000, 4000, 5000] },

  "N.A. Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000, 12500, 15000] },
  "E-A Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000, 12500, 15000] },
  "A-P Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000, 12500, 15000] },
  "L.A. Search Engine Advertising": { min: 0, max: 15000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000, 12500, 15000] },

  "N.A. Retailer Recruitment / Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "E-A Retailer Recruitment / Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "A-P Retailer Recruitment / Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] },
  "L.A. Retailer Recruitment / Support Budget": { min: 0, max: 10000, initialSteps: [0, 1000, 2500, 5000, 7500, 10000] }
};


// Modified detectProduct function with more reliable detection
function detectProduct() {
  const inputs = document.querySelectorAll('input.input-field');
  let foundProduct = null;
  
  for (const input of inputs) {
    const label = input.getAttribute("title") || input.getAttribute("aria-label");
    if (!label) continue;
    
    const cleanLabel = cleanupText(label);
    
    if (cleanLabel.includes('wholesaleprice')) {
      foundProduct = "acCamera";
      break;
    }
    if (cleanLabel.includes('retailprice')) {
      foundProduct = "uavDrone";
      break;
    }
  }
  
  console.log("Detected product:", foundProduct);
  return foundProduct;
}

// Log all input fields and their labels for debugging
function logInputFields() {
  const inputs = document.querySelectorAll('input.input-field');
  console.log("All input fields:");
  inputs.forEach(input => {
    const label = input.getAttribute("title") || input.getAttribute("aria-label");
    console.log(`Label: ${label}, Value: ${input.value}`);
  });
}

// Call this when starting optimization
logInputFields();

// Modified setInputValue function to properly handle both products' inputs
function setInputValue(input, value) {
  const label = input.getAttribute("title") || input.getAttribute("aria-label");
  const product = detectProduct();
  
  let constraints;
  if (product === "acCamera") {
    constraints = acCameraConstraints[label];
  } else if (product === "uavDrone") {
    // Find matching constraint for UAV drone by checking if the label contains any constraint key
    const matchingKey = Object.keys(uavDroneConstraints).find(key => {
      // Remove spaces and convert to lowercase for comparison
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
      const normalizedLabel = (label || '').toLowerCase().replace(/\s+/g, '');
      
      // Check if either contains the other
      return normalizedKey.includes(normalizedLabel) || normalizedLabel.includes(normalizedKey);
    });
    
    if (matchingKey) {
      constraints = uavDroneConstraints[matchingKey];
      console.log(`Found UAV constraint for ${label}: ${matchingKey}`, constraints);
    }
  }

  if (!constraints) {
    console.log(`No constraints found for label: ${label} (Product: ${product})`);
    return;
  }

  // Clamp value within min and max constraints
  const clampedValue = Math.min(Math.max(value, constraints.min), constraints.max);
  
  if (input.value !== clampedValue.toString()) {
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

// Helper function to cleanup text for comparison
function cleanupText(text) {
  return text.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
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
      
      // Modified optimizeInput function to use correct constraints and optimization strategy
async function optimizeInput(input, globalState = { bestCombo: {}, bestEPS: 0 }) {
  const label = input.getAttribute("title") || input.getAttribute("aria-label");
  const product = detectProduct();
  
  let inputConstraints;
  if (product === "acCamera") {
    inputConstraints = acCameraConstraints[label];
  } else if (product === "uavDrone") {
    inputConstraints = uavDroneConstraints[label];
  }

  if (!inputConstraints) {
    console.log(`No constraints found for label: ${label}`);
    return globalState;
  }

  let bestValue = parseFloat(input.value) || 0;
  let bestEPS = globalState.bestEPS;

  // Check if this is a budget or display input that needs initial broad sweep
  const needsBroadSweep = label.toLowerCase().includes("budget") || 
                         label.toLowerCase().includes("displays") || 
                         label.toLowerCase().includes("advertising");

  if (needsBroadSweep && inputConstraints.initialSteps) {
    console.log(`Starting broad sweep for ${label}`);
    // Initial broad sweep using predefined steps
    for (const testValue of inputConstraints.initialSteps) {
      setInputValue(input, testValue);
      await clickCalculate();
      await new Promise(r => setTimeout(r, 2));
      
      const currentMetrics = getMetrics();
      if (currentMetrics.eps > bestEPS) {
        bestEPS = currentMetrics.eps;
        bestValue = testValue;
        console.log(`New best found during broad sweep: ${label} = ${testValue}, EPS = ${bestEPS}`);
      }
    }

    // Fine-tuning phase with appropriate increments
    const searchRadius = label.includes("Website") ? 500 : 1000;
    const increment = label.includes("Website") ? 100 : 250;
    
    const searchMin = Math.max(inputConstraints.min, bestValue - searchRadius);
    const searchMax = Math.min(inputConstraints.max, bestValue + searchRadius);
    
    for (let testValue = searchMin; testValue <= searchMax; testValue += increment) {
      setInputValue(input, testValue);
      await clickCalculate();
      await new Promise(r => setTimeout(r, 2));
      
      const currentMetrics = getMetrics();
      if (currentMetrics.eps > bestEPS) {
        bestEPS = currentMetrics.eps;
        bestValue = testValue;
        console.log(`New best found during fine search: ${label} = ${testValue}, EPS = ${bestEPS}`);
      }
    }
  } else {
    // Use original precise optimization logic for prices
    const increments = [100, 50, 25, 10, 5, 1];
    for (let increment of increments) {
      let isImproving = true;
      while (isImproving) {
        isImproving = false;
        
        for (let direction of [-1, 1]) {
          const newValue = Math.max(
            inputConstraints.min,
            Math.min(inputConstraints.max, bestValue + direction * increment)
          );
          
          if (newValue === bestValue) continue;
          
          setInputValue(input, newValue);
          await clickCalculate();
          await new Promise(r => setTimeout(r, 2));
          
          const currentMetrics = getMetrics();
          if (currentMetrics.eps > bestEPS) {
            bestEPS = currentMetrics.eps;
            bestValue = newValue;
            isImproving = true;
            break;
          }
        }
      }
    }
  }

  // Return to best value found
  setInputValue(input, bestValue);
  await clickCalculate();
  await new Promise(r => setTimeout(r, 2));
  
  return {
    bestCombo: {
      ...globalState.bestCombo,
      [label]: bestValue
    },
    bestEPS: bestEPS
  };
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
      // Modified optimize function with improved tracking and state management
async function optimize() {
  // Global state to track best performance across all iterations
  const globalState = {
    bestCombo: {},
    bestEPS: 0,
    bestMetrics: null,
    lastImprovement: Date.now()
  };
  // Helper to check if we're still making progress
  const isStagnant = () => {
    return Date.now() - globalState.lastImprovement > 300000; // 5 minutes without improvement
  };
  while (isRunning) {
    // Always start by applying best known combination
    if (Object.keys(globalState.bestCombo).length > 0) {
      applyBestGlobalValues(globalState.bestCombo);
      await clickCalculate();
      await new Promise(r => setTimeout(r, 2));
    }
    // Get current metrics before optimization
    const currentMetrics = getMetrics();
    if (currentMetrics.eps > globalState.bestEPS) {
      globalState.bestEPS = currentMetrics.eps;
      globalState.bestMetrics = currentMetrics;
      globalState.bestCombo = captureCurrentValues();
      globalState.lastImprovement = Date.now();
      // Send update to popup
      chrome.runtime.sendMessage({
        type: 'newBestScore',
        score: currentMetrics.eps,
        metrics: currentMetrics,
        combo: globalState.bestCombo,
        timestamp: new Date().toLocaleTimeString()
      });
    }
    // Optimization strategies array
    const strategies = [
      { type: 'price', range: { min: 75, max: 1000 }, increment: 25 },
      { type: 'marketing', range: { min: 0, max: 10000 }, increment: 500 },
      { type: 'production', range: { min: 0, max: 5000 }, increment: 250 }
    ];
    // Optimize each input using appropriate strategy
    const inputs = document.querySelectorAll('input.input-field');
    for (const input of inputs) {
      if (!isRunning) break;
      const label = input.getAttribute("title") || input.getAttribute("aria-label");
      const strategy = getStrategyForInput(label, strategies);
      if (!strategy) continue;
      let localBestValue = parseFloat(input.value);
      let localBestEPS = currentMetrics.eps;
      for (let direction of [-1, 1]) {
        let currentValue = localBestValue;
        let noImprovementCount = 0;
        while (noImprovementCount < 3) { // Allow up to 3 attempts without improvement
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
            }
          } else {
            noImprovementCount++;
            currentValue = newValue;
          }
        }
      }
      // Always return to best known value for this input
      if (parseFloat(input.value) !== localBestValue) {
        setInputValue(input, localBestValue);
        await clickCalculate();
        await new Promise(r => setTimeout(r, 2));
      }
    }
    // If we haven't improved in a while, try random perturbations
    if (isStagnant()) {
      await randomizedSearch(globalState);
    }
    // Brief pause between full optimization cycles
    await new Promise(r => setTimeout(r, 5000));
  }
}
// Helper function to determine optimization strategy
function getStrategyForInput(label, strategies) {
  if (label.toLowerCase().includes('price')) {
    return strategies.find(s => s.type === 'price');
  } else if (label.toLowerCase().includes('budget') || 
             label.toLowerCase().includes('advertising') || 
             label.toLowerCase().includes('support')) {
    return strategies.find(s => s.type === 'marketing');
  } else if (label.toLowerCase().includes('displays') || 
             label.toLowerCase().includes('website') || 
             label.toLowerCase().includes('production')) {
    return strategies.find(s => s.type === 'production');
  }
  return null;
}
// Add randomized search to escape local maxima
async function randomizedSearch(globalState) {
  const inputs = document.querySelectorAll('input.input-field');
  const originalValues = {};
  // Save original values
  inputs.forEach(input => {
    originalValues[input.id] = parseFloat(input.value);
  });
  // Try random perturbations
  for (let attempt = 0; attempt < 10 && isRunning; attempt++) {
    inputs.forEach(input => {
      const label = input.getAttribute("title") || input.getAttribute("aria-label");
      const strategy = getStrategyForInput(label, [
        { type: 'price', range: { min: 75, max: 1000 } },
        { type: 'marketing', range: { min: 0, max: 10000 } },
        { type: 'production', range: { min: 0, max: 5000 } }
      ]);
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
      return; // Exit if we found an improvement
    }
  }
  // Restore best known values if no improvement found
  applyBestGlobalValues(globalState.bestCombo);
  await clickCalculate();
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