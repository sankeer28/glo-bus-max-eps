
# Glo-Bus Max EPS 💹

Chrome extension developed to help save time when finding the highest Earnings Per Share (EPS) in the Glo-Bus simulation by automating and applying the most optimal parameters. This extension actively monitors and iterates through financial inputs, recording the highest EPS scores achieved.

## Concepts used
- [Gradient Descent](https://www.geeksforgeeks.org/how-to-implement-a-gradient-descent-in-python-to-find-a-local-minimum/)
  - Used for finding optimal values by taking steps in the direction of improvement
  - Core optimization method for adjusting prices and budgets
- [Monte Carlo Method](https://pbpython.com/monte-carlo.html)
  - Random sampling technique used in the randomizedSearch function
  - Helps explore different value combinations
- [Weighted Scoring Algorithm](https://machinelearningmastery.com/weighted-average-ensemble-with-python/)
  - Used in calculateCompositeScore to combine multiple metrics
  - Assigns different weights to different performance indicators
- Greedy Algorithm
  - Takes locally optimal choices at each step
  - Used in the optimization process for immediate improvements
- Stochastic Search
  - Random exploration of the solution space
  - Helps avoid local maxima
- Linear Interpolation
  - Used for scaling values within constraints
  - Applied when adjusting input values


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

## 🚀 Features
- **Automatic Optimization**: Intelligently explores different input combinations
- **Real-time Score Tracking**: Monitors and updates best performance metrics
- **Flexible Strategy**: Adapts to different input types (prices, budgets, marketing)
- **History Tracking**: Maintains a log of best-performing strategies, accessible thorugh inspect element console
- **Easy-to-Use Interface**: Simple start/stop controls with detailed insights
  
## 🛠 Technical Highlights

- Chrome Extension architecture
- Advanced search and optimization algorithms
- Dynamic input value exploration
- Persistent state management
- Comprehensive metrics tracking
<details>
  <summary>Intelligent Multi-Dimensional Search</summary>


#### 1. Composite Score Calculation
- Calculates a comprehensive performance score beyond simple EPS
- Weights multiple metrics including revenue, profit, market share
- Provides a holistic view of strategy performance

#### 2. Adaptive Search Strategies
- **Incremental Search**: Methodically explores input values
- **Bidirectional Optimization**: Searches both increase and decrease directions
- **Randomized Global Search**: Prevents getting stuck in local optima

#### 3. Constraint-Aware Optimization
- Respects input value ranges and increments
- Validates and clamps values to acceptable ranges
- Ensures realistic and feasible strategy configurations

### Key Algorithmic Techniques

- **Dynamic Value Exploration**: Systematically tests input combinations
- **Stagnation Detection**: Prevents endless unproductive searches
- **Persistent State Tracking**: Remembers and builds upon best configurations

### Optimization Workflow

1. Initial Configuration Capture
2. Incremental Value Modification
3. Performance Metric Evaluation
4. Best Configuration Storage
5. Continuous Refinement
</details>

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
   - Click **Load unpacked** and select the latest version folder.
3. **Launch the Extension**:
   - Click on the Glo-Bus Max EPS icon.
   - Set a delay to control optimization speed (optional).
   - Start the extension by clicking **Start**.

## Usage
### Only use this extension on the "AC Camera Marketing" and "UAV Drone Marketing" pages. It will work on the "Product Design" page but will set R&D to 0, so change it back to the highest possible.


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
        
  12. **V11**
      - Fixed issue from V10, can now change "Average Wholesale Price to Retailers" for AC Camera
      - "Best EPS" does not update fast enough
      - removed "Apply Best Values"
      - on UAV page only "Search Engine Advertising" is being changed.
      
        
  13. **V12**
      - Sometimes when clicking "Stop" the EPS is not set to the Best EPS found. (can be overcome by not letting program run for too long)
      - "Best EPS" does not update fast enough
      - Fixed issue with V11, UAV page works properly
      - Does not properly find optimal weeks n % for sales promotion. (must do manually)
        
  14. **V13**
      - Optimized to use smaller increments to get potentially higher EPS compared to V12
      - "Best EPS" does not update fast enough
        
  15. **V14**
      - More optimized, achieves higher EPS than V13

    

</details>

## ⚠️ Disclaimer

This tool is for simulation purposes. Will no longer recieve updates, feel free to fork the repo and build on.



