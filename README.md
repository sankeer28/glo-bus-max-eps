
# Glo-Bus Max EPS 💹

Glo-Bus Max EPS is a Chrome extension developed to optimize Earnings Per Share (EPS) in the Glo-Bus simulation by automating and applying the best financial parameter configurations. This extension actively monitors and iterates through financial inputs, recording the highest EPS scores achieved. It includes an easy-to-use interface for controlling optimization and tracking historical scores.

# Only use this extension on the "AC Camera Marketing" and "UAV Drone Marketing" pages.
# This is not a program to guarantee first place for this simulation
## High EPS Strategy Guide

<details>
  <summary>Click to expand for full strategy tips</summary>

  - **Projected Performance**: Ensure that the left-hand side (Projected Performance) is higher than the right-hand side (Investors Expect).
  
  - **Research and Development**: Invest fully in R&D (buy all $50k available).
  
  - **Stock Buyback**: Try to buy back full stock as much as possible.
  
  - **Price/Quality Ratio**: Keep P/Q around the industry average. Higher P/Q is preferred as long as it does not negatively impact EPS.
  
  - **Manual Adjustments**: Always manually adjust values—the program is not 100% accurate.
  
  - **Loan Management**: Do NOT take out a loan.
  
  - **Cash Management**: Aim for non-negative ending cash but avoid keeping too much, as excess cash could be better invested.
  
  - **Corporate Social Responsibility Initiatives (CSRC)**:
    - Continue only:
      - "Cafeteria and On-Site Child Care Facilities for Plant Employees"
      - "Additional Safety Equipment and Improved Lighting / Ventilation"
    - Select "No" for all other CSRC initiatives.
  
  - **Overtime and Workstations**:
    - Allow overtime for workers if needed.
    - Ignore "Additional Workstations Needed to Avoid Overtime Assembly #" unless it increases EPS.
  
</details>

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

<details>
  <summary>Click to see what the different versions do</summary>

  1. **V1 - DO NOT USE**
     - Bad UI
     - Changes only the dropdown-style inputs
     - Changes competitive assumptions to best-case scenario (not ideal)

  2. **V2 - DO NOT USE**
     - New UI
     - Same issue as V1 with the program changing competitive assumptions

  3. **V3 - DO NOT USE**
     - Same issue as V1 and V2 with the program changing competitive assumptions

  4. **V4 - DO NOT USE**
     - "Best EPS" is broken
     - Adds so much to log that it breaks/freezes
     - Changes competitive assumptions

  5. **V5**
     - "Best EPS" issue is fixed
     - "Apply Values" button is broken
     - Adds so many past EPS logs that it may break/freeze
     - Unable to change "Average Wholesale Price to Retailers" for AC Camera, as it uses a number not in range

  6. **V6**
     - "Apply Values" button is broken
     - Adds so many EPS logs that it may break/freeze
     - Unable to change "Average Wholesale Price to Retailers" for AC Camera, as it uses a number not in range

  7. **V7**
     - "Apply Values" results in a lower EPS than recorded (somehow worse than V6)
     - Unable to change "Average Wholesale Price to Retailers" for AC Camera, as it uses a number not in range

  8. **V8**
     - "Apply Best Values" is broken
     - History is removed to save storage
     - Only info on the best EPS is recorded
     - Unable to change "Average Wholesale Price to Retailers" for AC Camera, as it uses a number not in range

  9. **V9**
     - "Apply Best Values" is broken
     - Added reset button to reset EPS (manual uninstall/reinstall was needed before)
     - Unable to change "Average Wholesale Price to Retailers" for AC Camera, as it uses a number not in range

  10. **V9.5**
      - "Apply Best Values" is broken
      - Attempted fix for entering a number within range for "Average Wholesale Price to Retailers" results in EPS dropping due to issues recording the highest EPS found so far, and other input ranges are broken

  11. **V10**
      - Reverted from V9.5
      - Unable to change "Average Wholesale Price to Retailers" for AC Camera, as it uses a number not in range
      - "Best EPS" does not update fast enough
      - "Apply Best Values" works sometimes (sometimes results in an EPS lower than best, sometimes higher than recorded best)

</details>


