
# Glo-Bus Max EPS 💹

Glo-Bus Max EPS is a Chrome extension developed to optimize Earnings Per Share (EPS) in the Glo-Bus simulation by automating and applying the best financial parameter configurations. This extension actively monitors and iterates through financial inputs, recording the highest EPS scores achieved. It includes an easy-to-use interface for controlling optimization and tracking historical scores.

# Only use this extension on the "AC Camera Marketing" and "UAV Drone Marketing" pages.
# This is not a program to guarantee first place for this simulation
### Here are some tips to follow for this specific strategy of high eps
- Under Projected Performance (red box) make sure the left hand side is more than the right (Investors Expect)
- Go all in on R&D (buy all 50k) 
- Try your best to buy back full stock
- keep p/q around industry average. higher is better if it does not affect eps
- always manually try adjusting the values, this program is **NOT** 100% perfect
- Do **NOT** take our a loan
- try not to have negative ending cash, but also not too much since it could've been invested
- coninue both Improved Working Conditions "Cafeteria and On-Site Child Care Facilities for Plant Employees" and "Additional Safety Equipment and Improved Lighting / Ventilation". No for everything else under CSRC Initiatives
- Do not be afraid to have your workers work overtime
  - You will see this in Compensationa nd fciltiies as "Additional Workstations Needed to Avoid Overtime Assembly #". ignore this unless ths brings EPS up.
  


## Table of Contents
- [Technical Overview](#technical-overview)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Key Code Components](#key-code-components)


## Features 🚀
⚠️ = May or may not work. 
- **Automated EPS Optimization**: Tests various input values to find configurations that yield the highest EPS. ⚠️
- **Financial Metrics Tracking**: Monitors EPS, net revenue, profit, cash, image rating, market share, stock price, and return on assets (ROA). ⚠️
- **Persistent Best Score**: Saves the best EPS score and input configuration, allowing users to reapply or reset values. ⚠️
- **Interactive UI**: Simple start/stop controls with delay customization. ✅
- **Historical Log**: Stores past scores and configurations for easy tracking and comparison. ⚠️

## Technical Overview

The core functionality of **Glo-Bus Max EPS** is driven by several key JavaScript functions working in concert:

1. **EPS Optimization**: The extension tests various inputs and dropdown selections to find the optimal EPS score by iterating through all possible configurations and calculating the resulting EPS.
2. **Metric Verification**: Each potential new EPS score is verified using `verifyComboScore` to ensure that scores are calculated accurately before updating the best score.
3. **Composite Scoring**: To establish the “best” EPS configuration, the `calculateCompositeScore` function weighs EPS heavily but also considers other financial metrics (profit, cash, etc.) using a weighted system to calculate a composite score.
4. **Chrome Storage**: The extension uses Chrome's `local storage` to save configurations, scores, and settings across browser sessions.

## Getting Started

### Prerequisites

- Chrome browser with Developer Mode enabled
- Basic familiarity with Chrome extensions and JavaScript

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sankeer28/glo-bus-max-eps.git
   ```
2. **Load as a Chrome Extension**:
   - Navigate to `chrome://extensions` in Chrome.
   - Enable **Developer Mode**.
   - Click **Load unpacked** and select the folder.
3. **Launch the Extension**:
   - Click on the Glo-Bus Max EPS icon.
   - Set a delay to control optimization speed (optional).
   - Start the extension by clicking **Start**.

## Usage

1. **Setting Delay**: Configure the delay in milliseconds to control the optimization loop's frequency.
2. **Start Optimization**: Clicking **Start** begins the input testing process, which continues until **Stop** is clicked.
3. **EPS Display**: The **Best EPS** score and associated configuration are shown in real-time.
4. **Resetting and Reapplying Values**: Users can reset the EPS and reapply the best values with the **Reset** and **Apply Best Values** options, respectively.
5. **Viewing History**: Track and compare past EPS scores with metrics details through the history log.

## Key Code Components

### Main JavaScript Functions

#### `optimizeInput` and `optimizeSelect`

These functions iteratively test different values for numeric input fields (`optimizeInput`) and dropdown selections (`optimizeSelect`). 

- **Input Optimization**: The `optimizeInput` function tests multiple values for each input, adjusting by a `stepSize` that gradually narrows to fine-tune EPS.
  - The function first sets a range (`min`, `max`) and attempts an initial `currentValue`. It then makes incremental changes, calling the `clickCalculate` function to trigger recalculations.
  - Each value change is followed by a delay, allowing EPS scores to update, and results are stored if a new best score is detected.
  
- **Select Optimization**: The `optimizeSelect` function iterates through all options within a select element.
  - It assigns each option’s value to the select field, calls `clickCalculate`, and compares the result against the current best score.
  - The function saves the highest EPS configuration by storing the score and associated metrics in Chrome's `local storage`.

#### `calculateCompositeScore`

This function assigns a weighted score based on financial metrics, with EPS contributing the highest weight. This approach ensures that EPS remains the primary optimization target but allows other metrics to influence the overall score, thereby producing a balanced and optimized financial configuration.

- **Metrics Weighting**: Each metric (e.g., net revenue, profit) is assigned a weight that contributes to the composite score, making it responsive to changes across all financial areas.
- **Best Metrics Update**: When new configurations improve upon any existing metric, they are saved as `bestMetrics`, updating both the current and historical best scores.

#### `verifyComboScore`

Before recording a new score, `verifyComboScore` recalculates EPS by applying the tested values and re-checking the result to avoid inaccuracies caused by floating-point discrepancies or delayed page updates. This function uses Chrome’s `executeScript` to interact with the page directly and confirms that the new EPS score is correct before updating the best score.

#### `updateBestScoreDisplay` and `updateHistoryUI`

These functions update the user interface:
- **`updateBestScoreDisplay`**: Displays the best EPS score along with buttons to apply or reset values.
- **`updateHistoryUI`**: Dynamically updates the history log, showing each EPS score along with relevant metrics and configuration details.

### Chrome Storage

The extension uses Chrome’s `chrome.storage.local` API to persist data, enabling it to save and retrieve:
- **isRunning**: Tracks the extension’s running state.
- **bestScore** and **bestCombo**: Stores the highest EPS score and the associated input configuration.
- **globalHistory**: Maintains a log of past scores and configurations for reference and comparison.

### UI Elements and Interactions

The UI, defined in `popup.html`, includes buttons for controlling the extension and a history log for tracking scores:
- **Start/Stop Buttons**: Initiates or halts the optimization.
- **Delay Setting**: Customizes the delay between optimization iterations.
- **Best Score Display**: Shows the highest EPS score achieved and allows reapplying it.
- **History Log**: Provides a historical view of scores, including the EPS and associated metrics, in a collapsible format.


