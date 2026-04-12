# Contract Development Environment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Hardhat-based contract development environment in the current project with working example contracts, tests, scripts, and documentation.

**Architecture:** Use a JavaScript-first Hardhat project layout modeled after the reference project, but keep the contract and script examples generic. Build the environment in layers: scaffold tooling first, then add tests, then implement contracts to satisfy those tests, then add scripts and docs, and finally run full verification.

**Tech Stack:** Hardhat, @nomicfoundation/hardhat-toolbox, dotenv, Solidity 0.8.24, JavaScript, npm

---

## File Structure

**Create:**

- `package.json`
- `.gitignore`
- `.env.example`
- `hardhat.config.js`
- `README.md`
- `contracts/Counter.sol`
- `contracts/MockERC20.sol`
- `scripts/deploy-counter.js`
- `scripts/deploy-mock-erc20.js`
- `scripts/interact-counter.js`
- `test/counter.test.js`
- `test/mock-erc20.test.js`

**Generate during verification:**

- `package-lock.json`
- `artifacts/`
- `cache/`

**Notes:**

- This directory is not a git repository, so commit steps from the standard workflow are not executable here.
- Subagent execution and reviewer loops require explicit user authorization for delegation. If that authorization is absent, execute in the current session and perform local review.

### Task 1: Scaffold the Hardhat Project Shell

**Files:**

- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `hardhat.config.js`
- Create: `README.md`

- [ ] **Step 1: Create package metadata and npm scripts**

Add a `package.json` with:

- project name appropriate for `contract-self`
- scripts:
  - `compile`
  - `test`
  - `clean`
  - `node`
  - `deploy:counter`
  - `deploy:token`
  - `interact:counter`
- dev dependencies:
  - `hardhat`
  - `@nomicfoundation/hardhat-toolbox`
  - `dotenv`

- [ ] **Step 2: Add ignore rules and env template**

Create:

- `.gitignore` for `node_modules`, `artifacts`, `cache`, `.env`
- `.env.example` with:
  - `PRIVATE_KEY`
  - `SEPOLIA_RPC_URL`
  - `ETH_MAINNET_RPC_URL`
  - `ETHERSCAN_API_KEY`

- [ ] **Step 3: Add Hardhat configuration**

Create `hardhat.config.js` with:

- `require("@nomicfoundation/hardhat-toolbox")`
- `require("dotenv").config()`
- Solidity `0.8.24`
- optimizer enabled with `runs: 200`
- networks:
  - `localhost`
  - `sepolia`
  - `mainnet`
- Etherscan API config using `ETHERSCAN_API_KEY`
- External network accounts set to `[]` when `PRIVATE_KEY` is missing

- [ ] **Step 4: Add initial README skeleton**

Write a README with sections for:

- prerequisites
- install
- environment setup
- compile
- test
- local node
- local deploy
- Sepolia deploy

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected:

- dependencies install successfully
- `package-lock.json` is generated

### Task 2: Add Contract Behavior Tests First

**Files:**

- Create: `test/counter.test.js`
- Create: `test/mock-erc20.test.js`

- [ ] **Step 1: Write the failing Counter test**

Add tests covering:

- initial value is `0`
- `increment()` increases the value to `1`
- `set(42)` updates the value to `42`

- [ ] **Step 2: Write the failing MockERC20 test**

Add tests covering:

- constructor assigns initial supply to deployer
- `transfer()` moves balances correctly
- transfer beyond sender balance reverts

- [ ] **Step 3: Run tests to verify they fail for the right reason**

Run: `npm test`

Expected:

- FAIL because the contracts are not implemented yet
- failure is due to missing contract sources or compile failure, not due to broken test syntax

### Task 3: Implement `Counter.sol` to Satisfy Tests

**Files:**

- Create: `contracts/Counter.sol`
- Test: `test/counter.test.js`

- [ ] **Step 1: Write the minimal Counter contract**

Implement:

- private or internal storage for current value
- `current()` view function
- `increment()` mutating function
- `set(uint256 newValue)` mutating function

- [ ] **Step 2: Run the Counter test only**

Run: `npx hardhat test test/counter.test.js`

Expected:

- Counter tests pass
- token tests may still fail because token contract is not implemented yet

- [ ] **Step 3: Refactor only if needed**

Keep the contract minimal and readable. Do not add extra access control, events, or features not required by the tests.

### Task 4: Implement `MockERC20.sol` to Satisfy Tests

**Files:**

- Create: `contracts/MockERC20.sol`
- Test: `test/mock-erc20.test.js`

- [ ] **Step 1: Write the minimal token contract**

Implement:

- public `name`, `symbol`, `decimals`, and `totalSupply`
- `balanceOf(address)` mapping getter
- constructor minting initial supply to deployer
- `transfer(address to, uint256 amount)` with insufficient-balance revert

- [ ] **Step 2: Run the token test only**

Run: `npx hardhat test test/mock-erc20.test.js`

Expected:

- token tests pass

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected:

- all tests pass

### Task 5: Add Deployment and Interaction Scripts

**Files:**

- Create: `scripts/deploy-counter.js`
- Create: `scripts/deploy-mock-erc20.js`
- Create: `scripts/interact-counter.js`

- [ ] **Step 1: Add the counter deployment script**

Deploy `Counter`, wait for deployment, and print the deployed address.

- [ ] **Step 2: Add the token deployment script**

Deploy `MockERC20` with reasonable sample constructor arguments and print the deployed address.

- [ ] **Step 3: Add the counter interaction script**

The script should:

- read the deployed counter contract address from an argument or hard-coded placeholder comment
- print the current value
- call `increment()`
- print the new value

Prefer a simple environment-variable or script-argument driven approach over introducing complex config files.

- [ ] **Step 4: Compile after adding scripts**

Run: `npm run compile`

Expected:

- compile succeeds

### Task 6: Finalize Documentation

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Expand README with exact commands**

Document:

- `npm install`
- copy `.env.example` to `.env`
- `npm run compile`
- `npm test`
- `npm run node`
- `npm run deploy:counter`
- `npm run deploy:token`
- `npm run interact:counter`

- [ ] **Step 2: Document network expectations**

Clarify:

- local development works without external RPC configuration
- Sepolia requires `SEPOLIA_RPC_URL` and `PRIVATE_KEY`
- verification credentials use `ETHERSCAN_API_KEY`

### Task 7: Run End-to-End Verification

**Files:**

- Verify: entire project

- [ ] **Step 1: Clean previous build outputs**

Run: `npm run clean`

Expected:

- Hardhat cache and artifacts are removed

- [ ] **Step 2: Re-compile from a clean state**

Run: `npm run compile`

Expected:

- compile succeeds from clean state

- [ ] **Step 3: Re-run full tests**

Run: `npm test`

Expected:

- all tests pass

- [ ] **Step 4: Verify the deployment script on the in-process Hardhat network**

Run: `npx hardhat run scripts/deploy-counter.js`

Expected:

- script succeeds
- deployed counter address is printed

- [ ] **Step 5: Verify token deployment script on the in-process Hardhat network**

Run: `npx hardhat run scripts/deploy-mock-erc20.js`

Expected:

- script succeeds
- deployed token address is printed

- [ ] **Step 6: Report actual verification results**

Summarize:

- install status
- compile status
- test status
- script verification status
- any limitations not covered in this pass, such as Sepolia deployment not being exercised without user-provided credentials
