# contract-self

A Hardhat-based Solidity workspace centered on the `SmartWallet` contract and its Sepolia integration flow.

## Prerequisites

- Node.js 20+ recommended
- npm

The template was verified on this machine with Node.js `18.20.4`, but Hardhat emits a warning on that runtime. Using Node.js 20+ avoids that warning and is the recommended setup.

## Install

```bash
npm install
```

## Environment Setup

Copy the example environment file and fill in values as needed:

```bash
cp .env.example .env
```

Environment variables:

- `RPC_URL`: Sepolia RPC endpoint
- `EOA_PRIVATE_KEY`: EOA private key used for EIP-7702 authorization tests
- `SPONSOR_PRIVATE_KEY`: sponsor private key used to send sponsored transactions
- `CHAIN_ID`: target chain id, currently `11155111`
- `ETHERSCAN_API_KEY`: Etherscan API key for contract verification
- `SMART_WALLET_ADDRESS`: deployed SmartWallet implementation address

## Compile

```bash
npm run compile
```

## Test

```bash
npm test
```

## Local Node

Start a local Hardhat node:

```bash
npm run node
```

## Deployment

Deploy the SmartWallet contract to the default network:

```bash
npm run deploy:smart-wallet
```

Deploy to Sepolia:

```bash
npm run deploy:smart-wallet:sepolia
```

The deploy script prints the deployed contract address after confirmation.

## Sepolia Type-4 Integration Test

The real-chain integration test is skipped by default so it does not spend gas during normal test runs.

Run it explicitly with:

```bash
npm run test:sepolia:type4
```

Test file:

- `test/smartWallet/type4-delegate-init-execute.test.js`

Related on-chain transaction log:

- `test/smartWallet/sepolia.md`

## Notes

- Local compile and test do not require external RPC credentials.
- The Sepolia type-4 integration test requires both `EOA_PRIVATE_KEY` and `SPONSOR_PRIVATE_KEY`.
- Sepolia deployment requires `RPC_URL` and a funded deployer key through the current Hardhat account configuration.
- Etherscan verification credentials are wired through `ETHERSCAN_API_KEY`.
