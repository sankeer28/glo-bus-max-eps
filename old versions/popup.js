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

async function resetState() {
  bestScore = 0;
  bestCombo = null;
  await saveState();
  updateBestScoreDisplay();
}


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

    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', async () => {
        try {
          await resetState();
          
          resetButton.textContent = 'Reset!';
          resetButton.style.backgroundColor = '#ff6b6b';
          setTimeout(() => {
            resetButton.textContent = 'Reset';
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



// Enhanced function to handle new scores with verification
async function handleNewScore(currentScore, currentCombo) {
  // Don't update if no score or combo
  if (!currentScore || !currentCombo) {
    console.log("Skipping update - invalid score or combo data");
    return;
  }

  // Add verification step before updating best score
  const verificationResult = await verifyComboScore(currentScore, currentCombo);
  
  if (!verificationResult.verified) {
    console.log("Score verification failed:", verificationResult.actualScore, "vs expected:", currentScore);
    return;
  }

  // Only update if the verified score is better than current best
  if (verificationResult.actualScore > bestScore) {
    console.log("New best score verified:", verificationResult.actualScore);
    bestScore = verificationResult.actualScore;
    bestCombo = JSON.parse(JSON.stringify(currentCombo));  // Deep copy
    
    await saveState();
    updateBestScoreDisplay();
  }
}

// Fixed verification function
async function verifyComboScore(score, combo) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (comboData) => {
      return new Promise((resolve) => {
        // Function to set input value
        const setInputValue = (input, value) => {
          const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
          input.value = formattedValue;
          const events = [
            new Event('input', { bubbles: true }),
            new Event('change', { bubbles: true }),
            new Event('blur', { bubbles: true })
          ];
          events.forEach(event => input.dispatchEvent(event));
        };

        // Function to set select value
        const setSelectValue = (select, value) => {
          const targetValue = String(value);
          const options = Array.from(select.options);
          const index = options.findIndex(o => String(o.value) === targetValue);
          if (index !== -1) {
            select.selectedIndex = index;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
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

        // Click calculate and wait for result
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

        // Function to get current EPS score
        const getEPS = () => {
          const rows = document.querySelectorAll('tr');
          for (const row of rows) {
            const measureCell = row.querySelector('td.measure');
            const scoreCell = row.querySelector('td.score.text-center');
            if (measureCell && scoreCell && 
                measureCell.textContent.toLowerCase().includes('earnings per share')) {
              return parseFloat(scoreCell.textContent.replace(/[$,%]/g, ''));
            }
          }
          return null;
        };

        // Apply values and verify score
        clickCalculate();
        
        // Wait for calculation to complete and check score
        setTimeout(() => {
          const actualScore = getEPS();
          resolve(actualScore);
        }, 1000);
      });
    },
    args: [combo]
  });


  const actualScore = result[0].result;
  
  return {
    verified: Math.abs(actualScore - score) < 0.01, // Allow small floating point differences
    actualScore: actualScore
  };
}

async function applyBestCombo(tab, combo) {
  if (!combo) {
    console.error('No combo data to apply');
    return;
  }

  console.log("Applying combo with expected score:", bestScore);
  
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (comboData) => {
        // Create a promise that times out after 10 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), 10000);
        });

        const applyValuesPromise = new Promise(async (resolve, reject) => {
          try {
            if (window.isApplyingCombo) {
              reject(new Error('Already applying combo'));
              return;
            }
            
            window.isApplyingCombo = true;
            console.log("Starting to apply values...");
            
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            
            // Enhanced input value setting with better selector
            const setInputValue = async (input, value, maxRetries = 3) => {
              const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
              let retries = 0;
              
              while (retries < maxRetries) {
                try {
                  // Force input to be writable
                  Object.defineProperty(input, 'value', {
                    writable: true,
                    configurable: true
                  });
                  
                  input.value = formattedValue;
                  
                  // Dispatch a comprehensive set of events
                  const events = [
                    new Event('input', { bubbles: true }),
                    new Event('change', { bubbles: true }),
                    new Event('blur', { bubbles: true }),
                    new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }),
                    new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true })
                  ];
                  
                  for (const event of events) {
                    input.dispatchEvent(event);
                    await sleep(50);
                  }
                  
                  // Additional validation
                  if (Math.abs(parseFloat(input.value) - parseFloat(formattedValue)) < 0.01) {
                    return true;
                  }
                  
                  retries++;
                  await sleep(100);
                } catch (error) {
                  console.error(`Error setting input value: ${error}`);
                  retries++;
                  await sleep(100);
                }
              }
              
              return false;
            };

            // Enhanced select value setting
            const setSelectValue = async (select, value, maxRetries = 3) => {
              const targetValue = String(value);
              const options = Array.from(select.options);
              const index = options.findIndex(o => String(o.value) === targetValue);
              
              if (index === -1) {
                console.error(`Value ${value} not found in select options`);
                return false;
              }
              
              let retries = 0;
              while (retries < maxRetries) {
                try {
                  select.selectedIndex = index;
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  await sleep(100);
                  
                  if (select.value === targetValue) {
                    return true;
                  }
                  
                  retries++;
                } catch (error) {
                  console.error(`Error setting select value: ${error}`);
                  retries++;
                  await sleep(100);
                }
              }
              
              return false;
            };

            // Enhanced calculate button click
            const clickCalculate = async (maxRetries = 3) => {
              let retries = 0;
              while (retries < maxRetries) {
                try {
                  const buttons = Array.from(document.getElementsByTagName('button'));
                  const calcBtn = buttons.find(b => 
                    b.textContent.toLowerCase().includes('calculate') || 
                    b.textContent.toLowerCase().includes('update scores')
                  );
                  
                  if (calcBtn) {
                    calcBtn.click();
                    await sleep(1000);
                    return true;
                  }
                  
                  retries++;
                  await sleep(100);
                } catch (error) {
                  console.error(`Error clicking calculate: ${error}`);
                  retries++;
                  await sleep(100);
                }
              }
              
              return false;
            };

            try {
              // Apply values with improved input selection
              console.log("Applying input and select values...");
              
              // Get all relevant inputs using multiple selectors
              const inputs = [
                ...document.querySelectorAll('input.input-field'),
                ...document.querySelectorAll('input[type="number"]'),
                ...document.querySelectorAll('input[formcontrolname]')
              ];
              
              const selects = document.querySelectorAll('select:not(.entry-assumptions-select)');
              
              // First pass: Apply all values
              const inputPromises = inputs.map(async input => {
                const id = input.id || input.name;
                if (comboData[id]) {
                  return setInputValue(input, comboData[id].value);
                }
                return true;
              });
              
              const selectPromises = Array.from(selects).map(async select => {
                const id = select.id || select.name;
                if (comboData[id]) {
                  return setSelectValue(select, comboData[id].value);
                }
                return true;
              });
              
              // Wait for all inputs and selects to be set
              await Promise.all([...inputPromises, ...selectPromises]);
              
              // Second pass: Verify and retry failed inputs
              for (const input of inputs) {
                const id = input.id || input.name;
                if (comboData[id]) {
                  const currentValue = parseFloat(input.value);
                  const targetValue = parseFloat(comboData[id].value);
                  if (Math.abs(currentValue - targetValue) >= 0.01) {
                    await setInputValue(input, targetValue);
                  }
                }
              }
              
              // Final calculation
              console.log("Performing final calculation...");
              const calculateSuccess = await clickCalculate();
              
              if (!calculateSuccess) {
                throw new Error('Failed to trigger calculation');
              }
              
              resolve(true);
            } catch (error) {
              reject(error);
            }
          } catch (error) {
            reject(error);
          } finally {
            window.isApplyingCombo = false;
          }
        });

        // Race between timeout and apply values
        return Promise.race([applyValuesPromise, timeoutPromise]);
      },
      args: [combo]
    });

    const success = result[0].result;
    if (success) {
      console.log("Successfully applied best values");
      return true;
    } else {
      console.error("Failed to apply best values");
      return false;
    }
  } catch (error) {
    console.error("Error in applyBestCombo:", error);
    window.isApplyingCombo = false;
    return false;
  }
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

      // Function to get metrics from the page
      function getMetrics() {
        const metrics = {
          eps: null,
          netRevenue: null,
          profit: null,
          cash: null,
          imageRating: null,
          marketShare: null,
          stockPrice: null,
          roa: null
        };
        
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          const measureCell = row.querySelector('td.measure');
          if (!measureCell) continue;
          
          const scoreCell = row.querySelector('td.score.text-center');
          if (!scoreCell) continue;
          
          const measureText = measureCell.textContent.toLowerCase();
          const scoreText = scoreCell.textContent;
          
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

      // Function to capture current input values
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
        
        return currentCombo;
      }
      

      async function optimizeInput(input) {
        let min = 0;
        let max = 10000
        let currentValue = Math.floor((max + min) / 2);
        let bestValue = currentValue;
        
        setInputValue(input, currentValue);
        await clickCalculate();
        await new Promise(r => setTimeout(r, delayMs));
        
        let currentMetrics = getMetrics();
        let bestScore = currentMetrics.eps;
        let bestMetricsFound = currentMetrics;
        
        let stepSize = (max - min) / 4; // Initial large step size
        while (stepSize >= 1) {
          const directions = [-1, 1];
          
          for (const direction of directions) {
            let newValue = currentValue + direction * stepSize;
            
            // Ensure newValue stays within bounds
            if (newValue >= min && newValue <= max) {
              setInputValue(input, newValue);
              await clickCalculate();
              await new Promise(r => setTimeout(r, delayMs));
              
              const newMetrics = getMetrics();
              
              if (newMetrics.eps > bestScore) {
                bestScore = newMetrics.eps;
                bestValue = newValue;
                bestMetricsFound = newMetrics;
                currentValue = newValue;
                
                chrome.runtime.sendMessage({
                  type: 'newBestScore',
                  score: bestScore,
                  metrics: newMetrics,
                  combo: captureCurrentValues(),
                  timestamp: new Date().toLocaleTimeString()
                });
              }
            }
          }
          // Gradually reduce the step size for finer tuning near optimal values
          stepSize = Math.floor(stepSize / 1.5);
        }
        
        // Finalize the optimized value
        setInputValue(input, bestValue);
        await clickCalculate();
        return { score: bestScore, metrics: bestMetricsFound };
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
      // Set up mutation observer to track score changes
      const observer = new MutationObserver(() => {
        const currentMetrics = getMetrics();
        if (currentMetrics.eps !== null && (!lastMetrics || currentMetrics.eps > lastMetrics.eps)) {
          lastMetrics = currentMetrics;
          
          // Send message with current values when new best score is found
          chrome.runtime.sendMessage({
            type: 'newBestScore',
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