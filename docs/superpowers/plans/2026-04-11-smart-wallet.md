# SmartWallet Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-entry EIP-7702-style `SmartWallet` implementation that supports implicit first-use initialization, owner direct execution, relayed execution with signed gas reimbursement, and EIP-1271 signature validation.

**Architecture:** Keep the existing repository shape by placing the implementation under `contracts/executors/` and the interface under `contracts/interfaces/`. Test the delegated execution model through a dedicated harness contract that `delegatecall`s into the implementation, so `notSelf` and namespaced storage behavior can be verified locally without native type-4 transaction support in Hardhat.

**Tech Stack:** Hardhat, Solidity 0.8.24, JavaScript tests, ethers, OpenZeppelin contracts

---

## File Structure

**Modify:**

- `package.json`
- `contracts/interfaces/ISmartWallet.sol`

**Create:**

- `contracts/executors/SmartWallet.sol`
- `contracts/mocks/DelegatedAccountHarness.sol`
- `contracts/mocks/MockCallTarget.sol`
- `contracts/mocks/MockERC20.sol`
- `test/helpers/smartWallet.js`
- `test/smart-wallet.test.js`

**Responsibilities:**

- `package.json`
  Add the OpenZeppelin dependency required for ECDSA, ERC-20 interfaces, and safe token transfer helpers.
- `contracts/interfaces/ISmartWallet.sol`
  Expand the wallet interface to include `getNonce()` and `isValidSignature(...)` while preserving the agreed `ExecuteParams` shape.
- `contracts/executors/SmartWallet.sol`
  Implement the delegated wallet logic: namespaced storage, `notSelf`, single-entry execution, signature recovery, nonce handling, gas reimbursement, EIP-1271, and revert bubbling.
- `contracts/mocks/DelegatedAccountHarness.sol`
  Simulate an EOA that has delegated to the implementation by forwarding arbitrary calls via `delegatecall`, while still being able to hold ETH for value transfers and gas reimbursement tests.
- `contracts/mocks/MockCallTarget.sol`
  Provide a controllable downstream target for successful calls, payable calls, sender/value recording, and revert bubbling tests.
- `contracts/mocks/MockERC20.sol`
  Provide an ERC-20 token for gas reimbursement tests.
- `test/helpers/smartWallet.js`
  Centralize digest building and signature generation so the test file stays readable and the execution-signature rules stay consistent.
- `test/smart-wallet.test.js`
  Integration tests for initialization, owner direct execution, relayed execution, gas reimbursement, replay protection, revert bubbling, and EIP-1271.

**Notes:**

- This directory is not a git repository, so commit steps from the standard workflow are not executable here.
- The harness is required because Hardhat does not natively provide an EIP-7702 delegated EOA execution environment for unit tests.
- Subagent review is not available unless the user explicitly authorizes delegation, so plan review must be done locally in this session.

### Task 1: Add the Test Scaffolding First

**Files:**

- Create: `test/helpers/smartWallet.js`
- Create: `test/smart-wallet.test.js`

- [ ] **Step 1: Write digest and signature helpers**

Create `test/helpers/smartWallet.js` with helpers for:

- building the execution digest from:
  - `dest`
  - `value`
  - `func`
  - `gasToken`
  - `gasFee`
  - `gasReceive`
  - `gasDeductBefore`
  - `userNonce`
  - `walletAddress`
  - `chainId`
- creating the prefixed execution signature using `wallet.signMessage(getBytes(messageHash))`
- creating a raw digest signature for EIP-1271 tests using the wallet signing key
- building default `ExecuteParams` objects that individual tests can override

- [ ] **Step 2: Write the initial failing integration test file**

Create `test/smart-wallet.test.js` with test groups for:

- direct calls to the implementation revert
- first signed execution initializes and executes in one call
- invalid first-use signature reverts and leaves owner unset
- owner direct execution after initialization succeeds without a signature
- relayed execution after initialization succeeds with a valid signature
- invalid nonce reverts
- replay of an old signed request reverts
- array length mismatch reverts
- native-token gas reimbursement works for both `gasDeductBefore` modes
- direct native-token transfer with empty calldata works
- ERC-20 gas reimbursement works
- downstream revert data bubbles up
- EIP-1271 returns the magic value for a valid owner signature
- EIP-1271 returns `0xffffffff` for invalid or uninitialized cases

- [ ] **Step 3: Structure the test setup around a delegated harness**

In the test file, define deployment/setup helpers that will later deploy:

- `SmartWallet` implementation
- `DelegatedAccountHarness`
- `MockCallTarget`
- `MockERC20`

Use `ethers.getContractAt("ISmartWallet", harnessAddress)` for wallet-facing calls so tests exercise the delegated context instead of the implementation address.

Create the test owner as an `ethers.Wallet.createRandom().connect(provider)` wallet,
then fund it from a default Hardhat signer. This gives the tests:

- a signer that can submit owner-direct transactions
- access to a raw signing key for EIP-1271 digest signatures
- full control over the same wallet identity across initialization, direct-use, and relay tests

- [ ] **Step 4: Run the test file and confirm it fails for the right reason**

Run: `npx hardhat test test/smart-wallet.test.js`

Expected:

- test load succeeds
- compile or deployment fails because the wallet and mocks do not exist yet
- failure is due to missing contract sources or missing interface functions, not broken JavaScript syntax

### Task 2: Add the Minimal Test Harness Contracts

**Files:**

- Create: `contracts/mocks/DelegatedAccountHarness.sol`
- Create: `contracts/mocks/MockCallTarget.sol`
- Create: `contracts/mocks/MockERC20.sol`
- Test: `test/smart-wallet.test.js`

- [ ] **Step 1: Implement the delegated harness**

Create `contracts/mocks/DelegatedAccountHarness.sol` with:

- an immutable `implementation` address set in the constructor
- a payable `receive()` function so the harness can hold ETH
- a payable `fallback()` that forwards calldata to `implementation` using `delegatecall`
- revert bubbling that returns the implementation revert data unchanged

Do not add access control or special-case routing. The harness exists only to provide a delegated execution context for tests.

- [ ] **Step 2: Implement the downstream call target**

Create `contracts/mocks/MockCallTarget.sol` with functions that let tests assert execution behavior:

- `increment()` to mutate state
- `incrementPayable()` to record `msg.sender`, `msg.value`, and increment a counter
- `revertWithMessage(string calldata message)` to test revert bubbling
- public getters or public state variables for:
  - counter
  - last caller
  - last value received

- [ ] **Step 3: Implement the ERC-20 mock**

Create `contracts/mocks/MockERC20.sol` as a minimal mint-at-construction token suitable for reimbursement tests.

Preferred shape:

- constructor takes `name`, `symbol`, `initialHolder`, `initialSupply`
- mints the full supply to `initialHolder`

Keep this mock minimal and self-contained. Do not add permit, access control, or
an OpenZeppelin dependency to this mock, so Task 2 can compile before the wallet
implementation dependency is added.

- [ ] **Step 4: Run the test file again**

Run: `npx hardhat test test/smart-wallet.test.js`

Expected:

- compile gets further than before
- tests still fail because `SmartWallet.sol` and the expanded interface are not implemented yet

### Task 3: Add the Contract Dependency and Expand the Interface

**Files:**

- Modify: `package.json`
- Modify: `contracts/interfaces/ISmartWallet.sol`
- Test: `test/smart-wallet.test.js`

- [ ] **Step 1: Add OpenZeppelin to the project dependencies**

Update `package.json` to add:

- `@openzeppelin/contracts`

Keep the existing Hardhat and dotenv versions untouched unless the install itself forces a compatible patch update.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected:

- OpenZeppelin is installed
- `package-lock.json` is updated

- [ ] **Step 3: Expand `ISmartWallet.sol`**

Modify `contracts/interfaces/ISmartWallet.sol` to include:

- `getNonce() external view returns (uint256)`
- `isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)`

Keep `ExecuteParams` exactly aligned with the approved spec:

- `dest`
- `value`
- `func`
- `gasToken`
- `gasFee`
- `gasReceive`
- `gasDeductBefore`
- `userNonce`
- `ownerSignature`

- [ ] **Step 4: Re-run the test file**

Run: `npx hardhat test test/smart-wallet.test.js`

Expected:

- compile proceeds past interface resolution
- tests still fail because wallet logic is not implemented yet

### Task 4: Implement the SmartWallet Core Execution Path

**Files:**

- Create: `contracts/executors/SmartWallet.sol`
- Modify: `contracts/interfaces/ISmartWallet.sol`
- Test: `test/smart-wallet.test.js`

- [ ] **Step 1: Add contract structure and storage**

Create `contracts/executors/SmartWallet.sol` with:

- SPDX and pragma aligned with the project
- `ISmartWallet` import
- OpenZeppelin imports for:
  - `ECDSA`
  - `IERC20`
  - `SafeERC20`
- immutable `SELF`
- ERC-7201 namespaced storage struct containing:
  - `owner`
  - `nonce`
  - `initialized`
  - `entered`
- internal storage accessor
- `notSelf` modifier
- `nonReentrant` modifier

- [ ] **Step 2: Add custom errors, events, and view functions**

Implement the agreed minimum surface:

- custom errors:
  - `DirectCallForbidden()`
  - `InvalidSignature()`
  - `InvalidNonce()`
  - `ArrayLengthMismatch()`
  - `InvalidGasReceiver()`
  - `InsufficientNativeBalance()`
  - `InsufficientTokenBalance()`
  - `NotOwner()`
- events:
  - `Initialized(address indexed owner)`
  - `Executed(address indexed caller, address[] dest, uint256[] value, bytes[] func)`
  - `GasPaid(address indexed token, address indexed receiver, uint256 amount)`
- view functions:
  - `owner()`
  - `getNonce()`

Only add additional errors or events if implementation clarity requires them.

- [ ] **Step 3: Implement the execution digest and signature recovery helpers**

Add internal helpers for:

- validating array lengths
- building the execution message hash from the exact approved field list
- wrapping the message hash with the Ethereum signed message prefix
- recovering the signer from `ownerSignature`

Keep the digest field order exactly aligned with the test helper so failures are easy to reason about.

- [ ] **Step 4: Implement first-use initialization and direct owner execution**

Inside `executeBatch(ExecuteParams calldata params)`:

- reject direct calls to the implementation
- enter the reentrancy guard
- validate array lengths
- if not initialized:
  - require a valid execution signature
  - require `params.userNonce == 0`
  - recover the signer
  - write it to `owner`
  - mark initialized
  - increment nonce before external effects
- else if `msg.sender == owner`:
  - require `params.gasFee == 0`
  - skip signature validation
  - skip wallet nonce consumption

- [ ] **Step 5: Implement relayed signed execution**

Continue `executeBatch(...)` with the relayed branch:

- if initialized and `msg.sender != owner`:
  - require a valid execution signature that recovers to `owner`
  - require `params.userNonce == current nonce`
  - increment nonce before any external calls or reimbursements

This branch must not check or store any `admin` address.

- [ ] **Step 6: Implement gas reimbursement and batched calls**

Add internal helpers for:

- native-token reimbursement
- ERC-20 reimbursement
- plain external `call` with revert bubbling

Behavior:

- if `gasFee == 0`, skip reimbursement
- if `gasFee > 0`, require nonzero `gasReceive`
- if `gasDeductBefore`, reimburse before the batch loop
- otherwise reimburse after the batch loop
- `value.length == 0` means every call uses zero native value
- `func[i] == 0x` with `value[i] > 0` must work for direct native-token transfers

- [ ] **Step 7: Run the wallet test file**

Run: `npx hardhat test test/smart-wallet.test.js`

Expected:

- most or all execution-path tests now pass
- any remaining failures are concentrated around EIP-1271 or edge-case assertions

### Task 5: Implement EIP-1271 and Finish Edge Cases

**Files:**

- Modify: `contracts/executors/SmartWallet.sol`
- Modify: `test/helpers/smartWallet.js`
- Modify: `test/smart-wallet.test.js`

- [ ] **Step 1: Implement `isValidSignature`**

Add EIP-1271 behavior to `SmartWallet.sol`:

- return `0xffffffff` when uninitialized
- recover against the provided digest directly, without adding an Ethereum signed message prefix
- return `0x1626ba7e` only when the recovered signer equals `owner`

Keep this logic separate from the execution digest helper used by `executeBatch`.

- [ ] **Step 2: Tighten the tests for 1271 and replay safety**

Make sure the tests explicitly cover:

- valid raw-digest EIP-1271 signature
- invalid EIP-1271 signature
- uninitialized EIP-1271 query
- first-use nonce consumption from `0` to `1`
- signed replay failure after nonce advancement
- native-token transfer to an EOA with empty calldata

- [ ] **Step 3: Run the focused wallet test file again**

Run: `npx hardhat test test/smart-wallet.test.js`

Expected:

- all SmartWallet tests pass

### Task 6: Run Full Verification and Clean Up

**Files:**

- Modify: `contracts/executors/SmartWallet.sol` if verification reveals issues
- Modify: `contracts/interfaces/ISmartWallet.sol` if verification reveals interface mismatches
- Modify: `test/helpers/smartWallet.js` if verification reveals digest mismatches
- Modify: `test/smart-wallet.test.js` only if a test is asserting behavior not in the approved spec

- [ ] **Step 1: Compile the whole workspace**

Run: `npm run compile`

Expected:

- Solidity compilation succeeds
- artifacts are generated for the wallet and mocks

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected:

- all tests pass

- [ ] **Step 3: Re-read the implementation against the approved spec**

Verify manually that the code still matches:

- single entrypoint only
- no admin role or admin checks
- no owner-to-admin binding
- no `delegatecall` or contract creation support in the wallet
- owner direct execution skips signature and wallet nonce consumption
- signed execution binds gas reimbursement into the digest
- EIP-1271 does not add an extra prefix

- [ ] **Step 4: Stop after local verification**

Because this directory is not a git repository:

- do not add commit steps
- do not claim git-based completion
- report exact verification commands and outcomes instead
