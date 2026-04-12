# SmartWallet Design

Date: 2026-04-11

## Context

This project is a Hardhat-based Solidity workspace. The reference implementation in
[`contracts/executors/example.sol`](../../../contracts/executors/example.sol) models an
EIP-7702 delegated smart account with `owner + admin` permissions and separate
admin-executed flows.

The target design for `SmartWallet.sol` is different:

- It must support a type-4 transaction where an EOA delegates to the wallet
  implementation and, in the same transaction, completes delegation,
  initialization, and execution.
- It must not bind a single admin to the owner.
- It must not require admin validation for relayed execution, because multiple
  relayers may sponsor gas for the same owner in production.
- It must expose EIP-1271 signature validation.

## Goals

- Implement a single-entry smart wallet interface around `executeBatch`.
- Allow first-time initialization to happen implicitly during the first
  signed execution.
- Allow the owner to call directly without an execution signature after
  initialization.
- Allow any relayer to submit a signed execution after initialization.
- Keep relayer gas reimbursement inside the signed payload.
- Preserve the reference implementation's safety properties that still apply to
  an EIP-7702 delegated EOA.

## Non-Goals

- No `admin` role.
- No admin authorization window or delegated admin trust model.
- No `pause` or `unpause` flow in the first version.
- No support for `delegatecall`.
- No support for contract deployment via `create` or `create2`.
- No owner rotation in the first version.

## Chosen Approach

Three approaches were considered:

1. A single `executeBatch` entrypoint that handles initialization, owner direct
   execution, and relayed execution.
2. Separate direct and signed execution entrypoints.
3. A separate `initializeAndExecute` entrypoint for first use.

Approach 1 is selected. It best matches the target type-4 transaction flow and
keeps the contract surface minimal.

## Contract Model

`SmartWallet.sol` is an implementation contract intended to run through EIP-7702
delegation. The implementation contract itself must reject direct use.

The design keeps two safety mechanisms from the reference contract:

- `SELF` + `notSelf`
  Prevent direct calls to the implementation contract itself. Logic is only meant
  to run when the EOA has delegated to this implementation.
- ERC-7201 namespaced storage
  Wallet state is stored in a dedicated namespace to avoid storage collisions in
  the delegated EOA context.

The first version keeps only the following wallet state:

- `owner`
- `nonce`
- `initialized`
- `entered`

No `admin`, `paused`, or authorization-expiry state is included.

## Interface Shape

The current interface in
[`contracts/interfaces/ISmartWallet.sol`](../../../contracts/interfaces/ISmartWallet.sol)
should evolve to include:

- `executeBatch(ExecuteParams calldata params)`
- `owner() external view returns (address)`
- `getNonce() external view returns (uint256)`
- `isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)`

`ExecuteParams` keeps the existing fields:

- `address[] dest`
- `uint256[] value`
- `bytes[] func`
- `address gasToken`
- `uint256 gasFee`
- `address gasReceive`
- `bool gasDeductBefore`
- `uint256 userNonce`
- `bytes ownerSignature`

This keeps the interface aligned with relayed execution and gas reimbursement.

## Execution Modes

`executeBatch` operates in three modes:

### 1. First execution and initialization

If the wallet is not initialized:

- `ownerSignature` is required.
- The contract recovers the signer from the execution digest.
- The recovered signer becomes `owner`.
- `initialized` is set to `true`.
- The same call continues to execute the requested batch.
- This path consumes the wallet nonce.

This is the path that enables delegation + initialization + execution in one
type-4 transaction.

### 2. Owner direct execution

If the wallet is initialized and `msg.sender == owner`:

- No execution signature is required.
- The wallet nonce is not consumed.
- `gasFee` should be zero for this path.

This keeps direct owner use lightweight and avoids requiring a wallet-level
nonce when the chain transaction nonce already prevents replay for the owner.

### 3. Relayed execution

If the wallet is initialized and `msg.sender != owner`:

- `ownerSignature` is required.
- `userNonce` must equal the current wallet nonce.
- The nonce is incremented before any external calls.
- Any relayer may submit the transaction if it has a valid owner signature.

There is no relayer allowlist and no admin check.

## Batch Call Semantics

The first version supports only ordinary external `call`.

- `dest[i]` is the target address.
- `value[i]` is the native token amount sent with that call.
- `func[i]` is the calldata.

This also covers native-token operations. To transfer the chain's native token:

- set `dest[i]` to the receiver
- set `value[i]` to the native-token amount
- set `func[i]` to empty bytes (`0x`)

The receiver may be an EOA or a contract that can accept the native token.

The contract must reject mismatched array lengths. `value` may either:

- have the same length as `dest` and `func`, or
- be empty, in which case all values are treated as zero.

The first version does not support:

- `delegatecall`
- `create`
- `create2`

Those capabilities materially change the wallet's storage and deployment risk
profile and are intentionally excluded from the first implementation.

## Signature Model

Relayed execution and first-time initialization both use the same signed digest.

The digest must bind the full execution intent:

- `dest`
- `value`
- `func`
- `gasToken`
- `gasFee`
- `gasReceive`
- `gasDeductBefore`
- `userNonce`
- `address(this)`
- `block.chainid`

This prevents:

- target replacement
- calldata replacement
- gas receiver replacement
- gas amount manipulation
- cross-wallet replay
- cross-chain replay

The implementation will follow the same signing style as the reference contract:

- compute `messageHash = keccak256(abi.encode(...))`
- wrap it as an Ethereum signed message hash
- recover the signer with ECDSA

## Nonce Rules

The wallet nonce is used only for signed execution paths.

- First-time initialization consumes the wallet nonce.
- Relayed execution after initialization consumes the wallet nonce.
- Owner direct execution does not consume the wallet nonce.

For signed execution paths:

- The initial wallet nonce is `0`.
- `params.userNonce` must match the current wallet nonce.
- The nonce is incremented before any gas deduction or external calls.

For successful signed executions, this prevents replay of already-consumed
authorizations. If a downstream call reverts and the transaction bubbles that
revert, all state changes, including the nonce increment, roll back as well.

## Gas Reimbursement

The existing gas-related fields remain part of `ExecuteParams` and are treated as
part of the signed authorization.

- `gasToken == address(0)` means reimbursement in the native token.
- `gasToken == address(0)` is the native token sentinel for the current chain.
- Otherwise reimbursement is paid in ERC-20.
- `gasReceive` is the reimbursement receiver.
- `gasDeductBefore` chooses whether reimbursement happens before or after batch
  execution.

Rules:

- Signed execution binds all gas fields into the execution digest.
- Owner direct execution should require `gasFee == 0`.
- If `gasFee == 0`, gas reimbursement is skipped.
- If `gasFee > 0`, `gasReceive` must not be the zero address.
- If native-token reimbursement is requested, the wallet must have sufficient
  balance.
- If ERC-20 reimbursement is requested, the wallet must have sufficient token
  balance.

The first version does not try to calculate gas dynamically on-chain. It only
executes the explicit reimbursement instruction that the owner signed.

## EIP-1271

The wallet must implement:

`isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)`

Behavior:

- If the wallet is not initialized, return `0xffffffff`.
- If the wallet is initialized and the recovered signer equals `owner`, return
  `0x1626ba7e`.
- Otherwise return `0xffffffff`.

This method validates only the provided `hash` and `signature`.

The wallet treats `hash` as the final digest provided by the caller. It does not
apply an additional Ethereum signed message prefix during EIP-1271 validation.

It does not:

- consume nonce
- initialize the wallet
- inspect batch parameters
- apply the wallet's execution digest format

This keeps EIP-1271 separate from the wallet's internal execution-authorization
scheme.

## Errors

The implementation should use custom errors instead of revert strings. Minimum
set:

- `DirectCallForbidden()`
- `AlreadyInitialized()`
- `NotOwner()`
- `InvalidSignature()`
- `InvalidNonce()`
- `ArrayLengthMismatch()`
- `InvalidGasReceiver()`
- `InsufficientNativeBalance()`
- `InsufficientTokenBalance()`
- `ExternalCallFailed(bytes returndata)`

Additional custom errors are acceptable if implementation clarity improves.

## Events

Minimum event set:

- `event Initialized(address indexed owner);`
- `event Executed(address indexed caller, address[] dest, uint256[] value, bytes[] func);`
- `event GasPaid(address indexed token, address indexed receiver, uint256 amount);`

`OwnerChanged` is intentionally not part of the first version because owner
rotation is not in scope yet.

Including `caller` in `Executed` makes it easy to distinguish owner-direct use
from relayed submission.

## Execution Order

`executeBatch` should follow this order:

1. Reject direct calls to the implementation.
2. Enter reentrancy guard.
3. Validate array lengths.
4. Branch by initialization state and caller:
   - initialize from signature if not initialized
   - allow direct owner execution without signature
   - otherwise require a valid owner signature
5. For signed paths, validate and consume nonce before external effects.
6. If `gasDeductBefore`, pay reimbursement.
7. Execute the batch using plain `call`.
8. If not `gasDeductBefore`, pay reimbursement.
9. Emit events and exit reentrancy guard.

## Testing Scope

The first implementation must cover at least these tests:

- Direct calls to the implementation contract revert.
- First execution with a valid signature performs initialization and batch
  execution in one call.
- First execution with an invalid signature reverts and does not initialize.
- Owner direct execution succeeds without a signature after initialization.
- Relayed execution succeeds with a valid signature after initialization.
- Relayed execution with an invalid nonce reverts.
- Replay of a previously used signed execution reverts.
- Array length mismatch reverts.
- Native-token reimbursement succeeds when `gasDeductBefore == true`.
- Native-token reimbursement succeeds when `gasDeductBefore == false`.
- Native-token transfer via `value > 0` and empty calldata succeeds.
- ERC-20 reimbursement succeeds.
- Downstream call revert data bubbles up.
- `isValidSignature` returns the EIP-1271 magic value for a valid owner signature.
- `isValidSignature` returns `0xffffffff` for an invalid signature.
- `isValidSignature` returns `0xffffffff` before initialization.

## Open Follow-Ups For Later Versions

These are intentionally postponed:

- owner rotation
- explicit domain separation upgrades such as EIP-712
- relayer policy restrictions
- delegatecall-based module systems
- deployment helpers for `create` or `create2`
- pausing and recovery flows

## Implementation Notes

The workspace currently does not include OpenZeppelin as a dependency, while the
reference contract imports OZ ECDSA and ERC-20 helpers. The implementation phase
must either:

- add the required OpenZeppelin dependency, or
- replace those utilities with local equivalents

Given the existing reference contract style, adding OpenZeppelin is the simpler
path unless project constraints require avoiding the dependency.
