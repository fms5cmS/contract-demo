require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  parseAbi,
  zeroAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { sepolia } = require("viem/chains");

const shouldRun = process.env.RUN_SEPOLIA_RELAY_APPROVE === "1";
const describeIf = shouldRun ? describe : describe.skip;
const chainLogPath = path.join(__dirname, `${sepolia.name.toLowerCase()}.md`);

const TOKEN = getAddress("0x10279e6333f9d0EE103F4715b8aaEA75BE61464C");
const SPENDER = getAddress("0xFdE37Fc2DFb18D5d901768A47c222feF30C7EFc5");
const GAS_RECEIVER = getAddress("0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a");
const APPROVE_AMOUNT = 10n;
const GAS_FEE = 1_000_000_000n;

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const smartWalletAbi = parseAbi([
  "function executeBatch((address[] dest,uint256[] value,bytes[] func,address gasToken,uint256 gasFee,address gasReceive,bool gasDeductBefore,uint256 userNonce,bytes ownerSignature) params)",
  "function owner() view returns (address)",
  "function getNonce() view returns (uint256)",
  "event GasPaid(address indexed token, address indexed receiver, uint256 amount)",
]);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(value) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function buildExecutionHash({
  dest,
  value,
  func,
  gasToken,
  gasFee,
  gasReceive,
  gasDeductBefore,
  userNonce,
  walletAddress,
  chainId,
}) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address[]" },
        { type: "uint256[]" },
        { type: "bytes[]" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "bool" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        dest,
        value,
        func,
        gasToken,
        gasFee,
        gasReceive,
        gasDeductBefore,
        userNonce,
        walletAddress,
        BigInt(chainId),
      ]
    )
  );
}

function appendChainLog({ hash, blockNumber, owner, description }) {
  let existing = "";
  if (fs.existsSync(chainLogPath)) {
    existing = fs.readFileSync(chainLogPath, "utf8");
  }

  if (existing.includes(hash)) {
    return;
  }

  const lines = [
    "",
    `## ${new Date().toISOString()}`,
    `- 合约: SmartWallet`,
    `- 测试文件: relayed-approve-native-gas-fee.test.js`,
    `- 交易哈希: \`${hash}\``,
    `- 区块号: ${blockNumber}`,
    `- 钱包 EOA: \`${owner}\``,
    `- 说明: ${description}`,
  ];

  fs.appendFileSync(chainLogPath, `${lines.join("\n")}\n`);
}

describeIf("SmartWallet Sepolia relayed approve with native gas fee", function () {
  this.timeout(180_000);

  let eoa;
  let publicClient;
  let sponsor;
  let sponsorClient;

  before(function () {
    const rpcUrl = requiredEnv("RPC_URL");

    eoa = privateKeyToAccount(normalizePrivateKey(requiredEnv("EOA_PRIVATE_KEY")));
    sponsor = privateKeyToAccount(
      normalizePrivateKey(requiredEnv("SPONSOR_PRIVATE_KEY"))
    );
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });
    sponsorClient = createWalletClient({
      account: sponsor,
      chain: sepolia,
      transport: http(rpcUrl),
    });
  });

  it("uses an owner signature and a sponsor-paid normal transaction to approve a token and reimburse native gas fee", async function () {
    const dest = [TOKEN];
    const value = [0n];
    const func = [
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SPENDER, APPROVE_AMOUNT],
      }),
    ];

    const [owner, userNonce, allowanceBefore, walletBalanceBefore] =
      await Promise.all([
        publicClient.readContract({
          address: eoa.address,
          abi: smartWalletAbi,
          functionName: "owner",
        }),
        publicClient.readContract({
          address: eoa.address,
          abi: smartWalletAbi,
          functionName: "getNonce",
        }),
        publicClient.readContract({
          address: TOKEN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [eoa.address, SPENDER],
        }),
        publicClient.getBalance({ address: eoa.address }),
      ]);

    expect(owner).to.equal(eoa.address);
    expect(userNonce).to.equal(1n);
    expect(allowanceBefore).to.equal(0n);
    expect(walletBalanceBefore).to.be.gte(GAS_FEE);

    const executionHash = buildExecutionHash({
      dest,
      value,
      func,
      gasToken: zeroAddress,
      gasFee: GAS_FEE,
      gasReceive: GAS_RECEIVER,
      gasDeductBefore: false,
      userNonce,
      walletAddress: eoa.address,
      chainId: sepolia.id,
    });
    const ownerSignature = await eoa.signMessage({
      message: { raw: executionHash },
    });

    const hash = await sponsorClient.sendTransaction({
      account: sponsor,
      data: encodeFunctionData({
        abi: smartWalletAbi,
        functionName: "executeBatch",
        args: [
          {
            dest,
            value,
            func,
            gasToken: zeroAddress,
            gasFee: GAS_FEE,
            gasReceive: GAS_RECEIVER,
            gasDeductBefore: false,
            userNonce,
            ownerSignature,
          },
        ],
      }),
      to: eoa.address,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 120_000,
    });
    expect(receipt.status).to.equal("success");

    appendChainLog({
      hash,
      blockNumber: receipt.blockNumber.toString(),
      owner: eoa.address,
      description:
        `配置文件中的 EOA ${eoa.address} 对 token ${TOKEN} 向 spender ${SPENDER} 授权 10。链上交易由 sponsor ${sponsor.address} 发起，使用普通交易（非 type-4）执行，SmartWallet 额外以主链币向 gasReceiver ${GAS_RECEIVER} 支付了 1 Gwei 的 gasFee。`,
    });

    const [allowanceAfter, walletNonceAfter, walletBalanceAfter] =
      await Promise.all([
        publicClient.readContract({
          address: TOKEN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [eoa.address, SPENDER],
        }),
        publicClient.readContract({
          address: eoa.address,
          abi: smartWalletAbi,
          functionName: "getNonce",
        }),
        publicClient.getBalance({ address: eoa.address }),
      ]);

    expect(allowanceAfter).to.equal(APPROVE_AMOUNT);
    expect(walletNonceAfter).to.equal(userNonce + 1n);
    expect(walletBalanceAfter).to.equal(walletBalanceBefore - GAS_FEE);
  });
});
