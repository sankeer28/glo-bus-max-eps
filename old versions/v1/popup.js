// popup.js
let isRunning = false;

function injectOptimizer(tab, delay) {
  // Instead of using new Function(), we'll pass the function directly
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function(delayMs) {
      let isRunning = true;
      let bestScore = -Infinity;
      let bestCombo = null;

      function getScore() {
        const scoreEl = document.querySelector('td.score.text-center');
        if (!scoreEl) return null;
        const score = parseFloat(scoreEl.textContent.replace(/[$,]/g, ''));
        return isNaN(score) ? null : score;
      }

      function setInputValue(input, value) {
        // Set the value
        input.value = value;
        
        // Create and dispatch all necessary events
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
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
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

      async function tryValues() {
        // Handle both input fields and select dropdowns
        const inputs = document.querySelectorAll('input[type="number"], input[formcontrolname]');
        const selects = document.querySelectorAll('select');
        const currentCombo = {};

        // Handle number inputs
        inputs.forEach(input => {
          const min = parseFloat(input.min) || 500;
          const max = parseFloat(input.max) || 5000;
          const step = parseFloat(input.step) || 1;
          const steps = Math.floor((max - min) / step);
          const value = min + (Math.floor(Math.random() * steps) * step);
          
          setInputValue(input, value);
          currentCombo[input.id || input.name || 'input'] = value;
        });

        // Handle select dropdowns
        selects.forEach(select => {
          const options = Array.from(select.options);
          if (options.length > 0) {
            const randomIndex = Math.floor(Math.random() * options.length);
            const value = options[randomIndex].value;
            setSelectValue(select, value);
            currentCombo[select.id || select.name || 'select'] = value;
          }
        });

        // Click calculate and wait for the page to update
        if (clickCalculate()) {
          await new Promise(r => setTimeout(r, 2000)); // Wait for calculation
          
          const score = getScore();
          if (score !== null && score > bestScore) {
            bestScore = score;
            bestCombo = currentCombo;
            console.log('New best score:', score);
            console.log('Values:', currentCombo);
          }
        }
      }

      async function optimize() {
        while (isRunning) {
          await tryValues();
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      optimize();
      window.stopOptimizer = () => { isRunning = false; };
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
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const log = document.getElementById('log');

  startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const delay = parseInt(document.getElementById('delay').value) || 2000;
    
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    log.textContent += `${new Date().toLocaleTimeString()}: Starting optimization...\n`;
    
    injectOptimizer(tab, delay);
  });

  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    log.textContent += `${new Date().toLocaleTimeString()}: Stopping optimization...\n`;
    
    stopOptimizer(tab);
  });
});