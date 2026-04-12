# Contract Development Environment Design

## Background

The current project directory `/Users/zzk/develop/work/contract-self` is empty.
The reference project `/Users/zzk/develop/work/FlagContract` uses a JavaScript-based Hardhat workflow with `@nomicfoundation/hardhat-toolbox` and `dotenv`.

The goal for this project is not to copy the reference project's business contracts or operational scripts.
The goal is to create a clean, reusable smart-contract development environment that follows the same engineering shape and developer workflow as the reference project.

## Goal

Build a reusable Hardhat contract project template in the current directory with:

- Hardhat-based compile, test, and deployment workflow
- Example contracts
- Example deployment and interaction scripts
- Working automated tests
- Environment variable placeholders for local development and Sepolia deployment
- Basic project documentation for day-one usage

## Non-Goals

This setup does not include:

- The reference project's business contracts
- Batch routing, account abstraction, or chain-specific business scripts
- Coverage tooling, gas reporting, upgrade tooling, or ignition
- TypeScript migration
- Mainnet-ready deployment automation beyond basic network placeholders

## Design Decisions

### 1. Toolchain

Use the same core toolchain shape as the reference project:

- `hardhat`
- `@nomicfoundation/hardhat-toolbox`
- `dotenv`
- JavaScript configuration and scripts
- `npm` with a generated `package-lock.json`

This keeps the developer experience close to the reference project and reduces friction when adding real contracts later.

### 2. Project Structure

The project will be created with this structure:

- `contracts/`
  - `Counter.sol`
  - `MockERC20.sol`
- `scripts/`
  - `deploy-counter.js`
  - `deploy-mock-erc20.js`
  - `interact-counter.js`
- `test/`
  - `counter.test.js`
  - `mock-erc20.test.js`
- `.env.example`
- `.gitignore`
- `README.md`
- `hardhat.config.js`
- `package.json`

Hardhat-generated directories such as `artifacts/` and `cache/` are intentionally excluded from the initial template.

### 3. Example Contracts

Two example contracts will be included.

`Counter.sol`

- Minimal stateful contract
- Supports reading the current value
- Supports incrementing
- Supports setting the value directly
- Acts as the simplest end-to-end example for compile, deploy, call, and test flows

`MockERC20.sol`

- Minimal ERC20-like token for local development and demonstrations
- Mints initial supply to the deployer in the constructor
- Supports standard balance tracking and transfer behavior
- Provides a realistic but lightweight token example for test and script workflows

The examples are intentionally generic so the template stays reusable.

### 4. Scripts

Each script should have one clear responsibility.

Planned scripts:

- `scripts/deploy-counter.js`
  - Deploy the counter contract and print the contract address
- `scripts/deploy-mock-erc20.js`
  - Deploy the mock token and print the contract address
- `scripts/interact-counter.js`
  - Read the current counter value, submit an update, and print the new value

The scripts should work on local Hardhat or localhost networks by default and be usable on Sepolia when the required environment variables are provided.

### 5. Hardhat Configuration

`hardhat.config.js` will:

- Use Solidity `0.8.24`
- Enable optimizer with `runs: 200`
- Load environment variables via `dotenv`
- Support these networks:
  - `hardhat`
  - `localhost`
  - `sepolia`
  - `mainnet` as an optional future-ready placeholder
- Configure Etherscan verification credentials using `ETHERSCAN_API_KEY`

Planned environment variables:

- `PRIVATE_KEY`
- `SEPOLIA_RPC_URL`
- `ETH_MAINNET_RPC_URL`
- `ETHERSCAN_API_KEY`

If a private key is not configured, external networks should use an empty accounts list rather than failing during config evaluation.

### 6. npm Scripts

`package.json` will include a minimal but complete workflow:

- `compile`
- `test`
- `clean`
- `node`
- `deploy:counter`
- `deploy:token`
- `interact:counter`

The deployment and interaction scripts will use Hardhat's standard `run` entrypoints.

### 7. Testing Strategy

The project should be locally verifiable immediately after dependency installation.

Planned test coverage:

`test/counter.test.js`

- Verifies initial value
- Verifies `increment()`
- Verifies `set(uint256)`

`test/mock-erc20.test.js`

- Verifies initial supply assignment to deployer
- Verifies token transfer behavior
- Verifies insufficient-balance revert path

The purpose of these tests is to prove the environment is functional, not to model business logic from the reference project.

### 8. Documentation

`README.md` will document:

- Prerequisites
- Install steps
- Environment configuration
- Compile command
- Test command
- Local node usage
- Local deployment example
- Sepolia deployment example

The documentation should let someone bootstrap the project without reading the source first.

## Error Handling and Constraints

- Missing `.env` values should not break local compile or local test flows.
- External deployment commands require the appropriate RPC URL and private key and will be documented as prerequisites.
- The template remains intentionally lightweight and avoids optional plugins unless they are required for the basic development loop.

## Verification Criteria

The environment is considered complete when all of the following are true:

- Dependencies install successfully with `npm install`
- `npm run compile` succeeds
- `npm test` succeeds
- Example deployment works on a local Hardhat node or local in-process network
- The README accurately documents the setup and usage flow

## Risks

- Installing dependencies may require network access and can be blocked by the environment until approval is granted.
- OpenZeppelin contracts are not planned unless needed; if imported, that adds dependency and template complexity.
- This directory is not currently a git repository, so the design document cannot be committed as required by the ideal workflow unless git is initialized later.

## Implementation Summary

The environment will mirror the reference project's workflow shape while staying generic:

- same Hardhat + toolbox + dotenv foundation
- same JavaScript-first configuration style
- generic example contracts instead of copied business contracts
- tests and scripts that prove the environment works end to end

This provides a clean starting point for future contract development in the current project.
