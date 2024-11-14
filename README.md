
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
  
## Features 🚀
⚠️ = May or may not work. 
- **Automated EPS Optimization**: Tests various input values to find configurations that yield the highest EPS. ⚠️
- **Financial Metrics Tracking**: Monitors EPS, net revenue, profit, cash, image rating, market share, stock price, and return on assets (ROA). ⚠️
- **Persistent Best Score**: Saves the best EPS score and input configuration, allowing users to reapply or reset values. ⚠️
- **Interactive UI**: Simple start/stop controls with delay customization. ✅

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

## Versions
1. V1 **DO NOT USE**
   - bad ui
   -  changes only the dropdown style inputs
   -   changes competative assumptions to best case scenerio (bad) 
3. V2 **DO NOT USE**
   - new ui
   -  same issue as V1 with program changing competative assumptions 
4. V3 **DO NOT USE**
   - same issue as V1 and V2 with program changing competative assumptions 
5. V4 **DO NOT USE**
   - "Best EPS" is broken
   -  adds so much to log it breaks/freezes
   -  changes competative assumptions
6. V5
   - "Best EPS" issue is fixed
   -  "apply values" button is broken
   -   adds so much past eps's to log it may break/freeze
   - unable to change "Average Wholesale Price to Retailers" for AC Camera as it uses a number not in range.
7. V6
   - "apply values" button is broken
   -  adds so much eps's to log it may break/freeze
   -  unable to change "Average Wholesale Price to Retailers" for AC Camera as it uses a number not in range.
9. V7
    - "apply values" results in a lower eps than what what recorded. somehow made this worse than V6
    - unable to change "Average Wholesale Price to Retailers" for AC Camera as it uses a number not in range.
10. V8
    - "apply best values" is broken
    - history is removed to save storage
    - only info on the best eps is recorded.
    - unable to change "Average Wholesale Price to Retailers" for AC Camera as it uses a number not in range.
11. V9
    - "apply best values" is broken
    - added reset button to reset eps (you had to manually uninstall/reinstall before).
    - unable to change "Average Wholesale Price to Retailers" for AC Camera as it uses a number not in range. 
12. V9.5
    - "apply best values" is broken
    - attempt to fix the issue with enteringa  number within range for "Average Wholesale Price to Retailers", results in eps dropping as there is an issue when recording highest eps found so far and the range for the other inputs are broken.
14. V10
    - reverted from v9.5
    - unable to change "Average Wholesale Price to Retailers" for AC Camera as it uses a number not in range.
    - "Best eps" does not update fast enough
    - "apply best values" works sometimes (sometimes results in an eps lower than best, sometimes even higher than recorded best)
    
