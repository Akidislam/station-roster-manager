# Station Roster Manager

Station Roster Manager is an operational scheduling web application designed for managers who oversee station-based work environments. In this operational model, **holidays and closure days are assigned directly to stations rather than individual employees independently**. When a station is closed on a given weekday, all team members assigned to that station receive that day off together.

The application includes an exact mathematical constraint solver, automated fairness optimization across consecutive weeks, interactive Monday-to-Sunday schedule management, real-time constraint validation, CSV/Print exports, and full JSON backup capabilities.

---

## 🛠️ Quick Start & Local Development

This project runs standard Node.js & npm scripts.

### 1. Prerequisites
- Node.js (v18.0 or newer recommended)
- npm (v9.0 or newer)

### 2. Setup & Execution Commands

```bash
# 1. Install all dependencies
npm install

# 2. Start the local development server (runs on port 3000)
npm run dev

# 3. Run automated tests (8 comprehensive test suites)
npm test

# 4. Compile the production bundle
npm run build
```

---

## 🚀 Deployment Instructions

### Deploy to Vercel
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your repository.
4. Framework Preset will be automatically detected as **Vite**.
5. Build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. Click **Deploy**.

### Deploy to Netlify
1. Log into [Netlify](https://www.netlify.com/) and choose **Add new site** > **Import an existing project**.
2. Select your Git provider and repository.
3. Configure the build parameters:
   - **Base directory:** Leave blank (root)
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site**.

---

## 📐 Mathematical Constraints & Scheduling Engine

The application does not use mock data or random guesses. It enforces an exact constraint programming model with backtracking and pruning:

1. **Exact Closures Per Station**: Each station is assigned exactly $k$ closure days per week (default: 2 days).
2. **Prohibited Days**: Station closures are prohibited on restricted days (default: Monday, Tuesday, Wednesday are prohibited; Thursday, Friday, Saturday, Sunday allow closures).
3. **Minimum Daily Operating Coverage**: The sum of stations operating on each weekday must be greater than or equal to the configured minimum threshold:
   - 3 stations: $\ge 1$ station open
   - 4 stations: $\ge 2$ stations open
   - 5 stations: $\ge 3$ stations open
4. **Critical Station Staffing Rule (Max 3 Members)**:
   - Each station can have 0, 1, 2, or 3 members.
   - A fourth member is strictly prohibited and enforced in the UI and data layer.
   - When a station is closed, all assigned members (0 to 3) receive the same day off simultaneously without cross-station transfers.
5. **No Station Splitting**: Stations are either 100% open or 100% closed on any given day. Members assigned to a station do not transfer across stations.
6. **Deterministic Fairness Optimization**: When multiple valid schedules exist, the solver evaluates historical assignments from prior weeks and selects the schedule that minimizes repetitive weekday assignments and balances weekend/weekday time off.
7. **Mathematical Feasibility Proofs**:
   - For 5 stations requiring 2 closures each (10 closures needed) with $\ge 3$ open stations (max 2 closures/day) across only 4 allowed days (Thu–Sun), the maximum weekly capacity is $4 \times 2 = 8$ closures.
   - The engine automatically detects the 2-slot deficit, displays a formal proof, and proposes actionable alternatives (such as allowing closures on Monday and Tuesday while keeping Wednesday strictly prohibited).

---

## 💾 Data Persistence & Safety

- **Storage Technology**: Data is stored using the browser's `localStorage` under key `station_roster_data_v1` with schema versioning.
- **Data Scope**: Because data is saved locally in your browser, schedules and workforce assignments are device- and browser-specific. Changes made on one device will not automatically sync to other devices or team members.
- **Backup & Restore**: Use the **Data & Backup** button in the top navigation to:
  - Download a full JSON backup of all stations, members, policies, and schedules.
  - Upload and validate a previously exported backup file before restoring it.
  - Reset to the clean default 4-station demo dataset.

---

## 🧪 Automated Test Suite

Run `npm test` to execute the Vitest test suite, which verifies:
1. **3 Stations Feasibility**: Verified with 2 closures per station and $\ge 1$ station open daily.
2. **4 Stations Feasibility**: Verified with 2 closures per station and $\ge 2$ stations open daily.
3. **5 Stations Default Infeasibility**: Detects the mathematical capacity bound ($10 > 8$) and blocks scheduling.
4. **5 Stations Alternative Policy**: Verifies successful generation under Monday + Tuesday allowed policy with $\ge 3$ open daily.
5. **Prohibited Day Violations**: Detects illegal closure assignments on protected weekdays.
6. **Invalid Manual Edits**: Instantly catches manual user errors (such as over-assigning closures or breaching daily minimums).
7. **Fairness Non-Interference**: Ensures fairness scoring never overrides mandatory constraints.
8. **Impossible Policy Rejection**: Proves that impossible parameter configurations can never produce a published roster.
9. **Critical Station Staffing Rule Enforcement**: Enforces that each station may have 0, 1, 2, or 3 members, and strictly rejects any attempt to assign a fourth member.
