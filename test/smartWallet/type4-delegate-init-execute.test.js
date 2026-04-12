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
const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { sepolia } = require("viem/chains");

const shouldRun = process.env.RUN_SEPOLIA_TYPE4 === "1";
const describeIf = shouldRun ? describe : describe.skip;
const chainName = sepolia.name.toLowerCase();
const chainLogPath = path.join(__dirname, `${chainName}.md`);

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

function buildExecutionHash({ dest, value, func, owner, chainId }) {
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
        zeroAddress,
        0n,
        zeroAddress,
        false,
        0n,
        owner,
        BigInt(chainId),
      ]
    )
  );
}

function appendChainLog({
  hash,
  blockNumber,
  owner,
  implementation,
  spender,
  sponsor,
}) {
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
    `- 测试文件: type4-delegate-init-execute.test.js`,
    `- 交易哈希: \`${hash}\``,
    `- 区块号: ${blockNumber}`,
    `- 说明: 赞助地址 ${sponsor} 发起了一笔 type-4 交易，将新的 EOA ${owner} 委托到实现合约 ${implementation}，触发 \`Initialized\` 事件，并向 spender ${spender} 完成了 3 笔 ERC20 授权，额度分别为 1、2、3。`,
  ];

  fs.appendFileSync(chainLogPath, `${lines.join("\n")}\n`);
}

describeIf("SmartWallet Sepolia type-4 approvals", function () {
  this.timeout(180_000);

  let implementation;
  let publicClient;
  let sponsor;
  let sponsorClient;

  before(function () {
    const rpcUrl = requiredEnv("RPC_URL");

    implementation = getAddress(requiredEnv("SMART_WALLET_ADDRESS"));
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

  it("delegates a fresh EOA and approves the three requested tokens in the same type-4 transaction", async function () {
    const owner = privateKeyToAccount(generatePrivateKey());
    const dest = TOKENS.map(({ address }) => getAddress(address));
    const value = [0n, 0n, 0n];
    const func = TOKENS.map(({ amount }) =>
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [getAddress(SPENDER), amount],
      })
    );
    const executionHash = buildExecutionHash({
      dest,
      value,
      func,
      owner: owner.address,
      chainId: sepolia.id,
    });
    const ownerSignature = await owner.signMessage({
      message: { raw: executionHash },
    });
    const authorization = await owner.signAuthorization({
      address: implementation,
      chainId: sepolia.id,
      nonce: 0,
    });

    const hash = await sponsorClient.sendTransaction({
      account: sponsor,
      authorizationList: [authorization],
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
            ownerSignature,
          },
        ],
      }),
      to: owner.address,
      type: "eip7702",
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 120_000,
    });
    expect(receipt.status).to.equal("success");

    appendChainLog({
      hash,
      blockNumber: receipt.blockNumber.toString(),
      owner: owner.address,
      implementation,
      spender: getAddress(SPENDER),
      sponsor: sponsor.address,
    });

    const expectedCode = `0xef0100${implementation.toLowerCase().slice(2)}`;
    const [code, walletOwner, walletNonce] = await Promise.all([
      publicClient.getCode({ address: owner.address }),
      publicClient.readContract({
        address: owner.address,
        abi: smartWalletAbi,
        functionName: "owner",
      }),
      publicClient.readContract({
        address: owner.address,
        abi: smartWalletAbi,
        functionName: "getNonce",
      }),
    ]);

    expect(code.toLowerCase()).to.equal(expectedCode);
    expect(walletOwner).to.equal(owner.address);
    expect(walletNonce).to.equal(1n);

    const allowances = await Promise.all(
      TOKENS.map(({ address }) =>
        publicClient.readContract({
          address: getAddress(address),
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner.address, getAddress(SPENDER)],
        })
      )
    );

    expect(allowances).to.deep.equal(TOKENS.map(({ amount }) => amount));
  });
});
