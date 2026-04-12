require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  parseAbi,
  parseEther,
  zeroAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { sepolia } = require("viem/chains");

const shouldRun = process.env.RUN_SEPOLIA_DIRECT_REVOKE === "1";
const describeIf = shouldRun ? describe : describe.skip;
const chainLogPath = path.join(__dirname, `${sepolia.name.toLowerCase()}.md`);
const topUpTargetBalance = parseEther("0.0003");

const TOKENS = [
  { address: "0x0B6a0A69B7040b2281730cBaE6060b3b1b2ed3A9", amount: 1n },
  { address: "0xd67215fD6c0890493F34aF3C5E4231cE98871fCb", amount: 2n },
  { address: "0x10279e6333f9d0EE103F4715b8aaEA75BE61464C", amount: 3n },
];
const SPENDER = "0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C";

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const smartWalletAbi = parseAbi([
  "function executeBatch((address[] dest,uint256[] value,bytes[] func,address gasToken,uint256 gasFee,address gasReceive,bool gasDeductBefore,uint256 userNonce,bytes ownerSignature) params)",
  "function owner() view returns (address)",
  "function getNonce() view returns (uint256)",
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
    `- 测试文件: direct-execute-batch-revoke.test.js`,
    `- 交易哈希: \`${hash}\``,
    `- 区块号: ${blockNumber}`,
    `- 钱包 EOA: \`${owner}\``,
    `- 说明: ${description}`,
  ];

  fs.appendFileSync(chainLogPath, `${lines.join("\n")}\n`);
}

async function ensureGasBalance({
  owner,
  publicClient,
  sponsorClient,
}) {
  const balance = await publicClient.getBalance({ address: owner.address });
  if (balance >= topUpTargetBalance) {
    return;
  }

  const topUpAmount = topUpTargetBalance - balance;

  // Use a constructor that immediately selfdestructs to force-send ETH to the
  // delegated EOA, since regular native transfers to the delegated wallet may revert.
  const initCode = `0x73${owner.address.slice(2)}ff`;
  const hash = await sponsorClient.sendTransaction({
    data: initCode,
    to: null,
    value: topUpAmount,
  });

  await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
}

describeIf("SmartWallet Sepolia direct batch revoke", function () {
  this.timeout(180_000);

  let eoa;
  let eoaClient;
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
    eoaClient = createWalletClient({
      account: eoa,
      chain: sepolia,
      transport: http(rpcUrl),
    });
    sponsorClient = createWalletClient({
      account: sponsor,
      chain: sepolia,
      transport: http(rpcUrl),
    });
  });

  it("uses a normal transaction from the configured EOA to batch revoke the three approvals", async function () {
    const spender = getAddress(SPENDER);
    const dest = TOKENS.map(({ address }) => getAddress(address));
    const value = [0n, 0n, 0n];
    const func = TOKENS.map(() =>
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, 0n],
      })
    );

    const [code, owner, walletNonce, allowancesBefore] = await Promise.all([
      publicClient.getCode({ address: eoa.address }),
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
      Promise.all(
        TOKENS.map(({ address }) =>
          publicClient.readContract({
            address: getAddress(address),
            abi: erc20Abi,
            functionName: "allowance",
            args: [eoa.address, spender],
          })
        )
      ),
    ]);

    expect(code.toLowerCase()).to.equal(
      `0xef0100${getAddress(requiredEnv("SMART_WALLET_ADDRESS")).toLowerCase().slice(2)}`
    );
    expect(owner).to.equal(eoa.address);
    expect(walletNonce).to.equal(1n);
    expect(allowancesBefore).to.deep.equal(TOKENS.map(({ amount }) => amount));

    await ensureGasBalance({
      owner: eoa,
      publicClient,
      sponsorClient,
    });

    const hash = await eoaClient.sendTransaction({
      account: eoa,
      data: encodeFunctionData({
        abi: smartWalletAbi,
        functionName: "executeBatch",
        args: [
          {
            dest,
            value,
            func,
            gasToken: zeroAddress,
            gasFee: 0n,
            gasReceive: zeroAddress,
            gasDeductBefore: false,
            userNonce: 0n,
            ownerSignature: "0x",
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
        `配置文件中的 EOA ${eoa.address} 直接发起了一笔普通交易（非 type-4），在已经完成委托和初始化的 SmartWallet 上执行批量取消授权，将 spender ${spender} 对 3 个 ERC20 的授权额度统一撤销为 0。`,
    });

    const [walletNonceAfter, allowancesAfter] = await Promise.all([
      publicClient.readContract({
        address: eoa.address,
        abi: smartWalletAbi,
        functionName: "getNonce",
      }),
      Promise.all(
        TOKENS.map(({ address }) =>
          publicClient.readContract({
            address: getAddress(address),
            abi: erc20Abi,
            functionName: "allowance",
            args: [eoa.address, spender],
          })
        )
      ),
    ]);

    expect(walletNonceAfter).to.equal(1n);
    expect(allowancesAfter).to.deep.equal([0n, 0n, 0n]);
  });
});
