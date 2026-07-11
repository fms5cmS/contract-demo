require("dotenv").config({ path: [".env.common", ".env.tx"] });

const {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  parseAbi,
  zeroAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const okx = require("./lib/okx-client");

const smartWalletAbi = parseAbi([
  "function executeBatchByAdmin((address[] dest,uint256[] value,bytes[] func,address gasToken,uint256 gasFee,address gasReceive,bool gasDeductBefore,uint256 nonce,uint256 deadline,bytes ownerSignature) params)",
  "function getNonce() view returns (uint256)",
]);
function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizePrivateKey(value) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function isTruthyFlag(value) {
  return (value || "").toLowerCase() === "true";
}

// FEE_PERCENT as a decimal string (e.g. "0.5" = 0.5%), applied to `base` with
// 0.01%-precision basis points so we never touch floating point on-chain amounts.
function applyFeePercent(base, feePercentStr) {
  const bp = Math.round(parseFloat(feePercentStr) * 100);
  if (!Number.isFinite(bp) || bp < 0) {
    throw new Error(`Invalid FEE_PERCENT: ${feePercentStr}`);
  }
  return (base * BigInt(bp)) / 10000n;
}

async function resolveChainIndex(creds, chainId) {
  const chains = await okx.getSupportedChains(creds);
  const match = chains.find((c) => String(c.chainIndex) === String(chainId));
  if (!match) {
    throw new Error(
      `chainId ${chainId} not found in OKX /supported/chain response. ` +
        `Got chainIndex values: ${chains.map((c) => c.chainIndex).join(", ")}`
    );
  }
  return match.chainIndex;
}

async function main() {
  const rpcUrl = requiredEnv("RPC_URL");
  const chainId = Number(requiredEnv("CHAIN_ID"));
  const smartWalletAddress = getAddress(requiredEnv("SMART_WALLET_ADDRESS"));

  const sponsor = privateKeyToAccount(
    normalizePrivateKey(process.env.SPONSOR_PRIVATE_KEY || requiredEnv("PRIVATE_KEY"))
  );
  const eoa = privateKeyToAccount(normalizePrivateKey(requiredEnv("EOA_PRIVATE_KEY")));

  const side = requiredEnv("SWAP_SIDE").toLowerCase();
  if (side !== "buy" && side !== "sell") {
    throw new Error(`SWAP_SIDE must be "buy" or "sell", got: ${side}`);
  }
  const fromTokenAddress = getAddress(requiredEnv("FROM_TOKEN_ADDRESS"));
  const toTokenAddress = getAddress(requiredEnv("TO_TOKEN_ADDRESS"));
  const amount = BigInt(requiredEnv("AMOUNT"));
  const slippagePercent = requiredEnv("SLIPPAGE_PERCENT");
  const swapReceiverAddress = process.env.SWAP_RECEIVER_ADDRESS
    ? getAddress(process.env.SWAP_RECEIVER_ADDRESS)
    : eoa.address;
  const feePercent = requiredEnv("FEE_PERCENT");
  const gasReceive = getAddress(requiredEnv("GAS_RECEIVE_ADDRESS"));
  const broadcast = isTruthyFlag(process.env.BROADCAST);

  const okxCreds = {
    apiKey: requiredEnv("OKX_API_KEY"),
    secret: requiredEnv("OKX_API_SECRET"),
    passphrase: requiredEnv("OKX_API_PASSPHRASE"),
    project: requiredEnv("OKX_API_PROJECT"),
  };

  const chain = {
    id: chainId,
    name: "custom",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const sponsorClient = createWalletClient({ account: sponsor, chain, transport: http(rpcUrl) });

  console.log("chainId:", chainId);
  console.log("sponsor (broadcaster):", sponsor.address);
  console.log("eoa (delegating owner / payer):", eoa.address);
  console.log("side:", side, "| dry-run:", !broadcast);

  const chainIndex = await resolveChainIndex(okxCreds, chainId);
  console.log("OKX chainIndex:", chainIndex);

  const isFromNative = fromTokenAddress.toLowerCase() === okx.OKX_NATIVE_TOKEN_ADDRESS.toLowerCase();
  const isToNative = toTokenAddress.toLowerCase() === okx.OKX_NATIVE_TOKEN_ADDRESS.toLowerCase();

  const dest = [];
  const value = [];
  const func = [];

  if (!isFromNative) {
    const approveTx = await okx.getApproveTransaction(okxCreds, {
      chainIndex,
      tokenContractAddress: fromTokenAddress,
      approveAmount: amount.toString(),
    });
    console.log("approve target (dexContractAddress):", approveTx.dexContractAddress);
    dest.push(fromTokenAddress);
    value.push(0n);
    func.push(approveTx.data);
  }

  const swapData = await okx.getSwap(okxCreds, {
    chainIndex,
    fromTokenAddress,
    toTokenAddress,
    amount: amount.toString(),
    slippagePercent,
    userWalletAddress: eoa.address,
    swapReceiverAddress,
  });
  console.log("swap tx.to:", swapData.tx.to);
  console.log("swap minReceiveAmount:", swapData.tx.minReceiveAmount);

  dest.push(getAddress(swapData.tx.to));
  value.push(BigInt(swapData.tx.value || "0"));
  func.push(swapData.tx.data);

  let gasToken;
  let gasFee;
  let gasDeductBefore;
  if (side === "buy") {
    gasToken = isFromNative ? zeroAddress : fromTokenAddress;
    gasFee = applyFeePercent(amount, feePercent);
    gasDeductBefore = true;
  } else {
    gasToken = isToNative ? zeroAddress : toTokenAddress;
    gasFee = applyFeePercent(BigInt(swapData.tx.minReceiveAmount), feePercent);
    gasDeductBefore = false;
  }
  console.log("gasToken:", gasToken, "| gasFee:", gasFee.toString(), "| gasReceive:", gasReceive);

  const implementationBytecode = await publicClient.getCode({ address: smartWalletAddress });
  const stateOverride = [{ address: eoa.address, code: implementationBytecode }];

  const currentNonce = await publicClient.readContract({
    address: eoa.address,
    abi: smartWalletAbi,
    functionName: "getNonce",
    stateOverride,
  });
  console.log("current SmartWallet nonce for EOA:", currentNonce.toString());

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const executeParams = {
    dest,
    value,
    func,
    gasToken,
    gasFee,
    gasReceive,
    gasDeductBefore,
    nonce: currentNonce,
    deadline,
  };

  const ownerSignature = await eoa.signTypedData({
    domain: {
      name: "SmartWallet",
      version: "3",
      chainId,
      verifyingContract: eoa.address,
    },
    types: {
      Execute: [
        { name: "dest", type: "address[]" },
        { name: "value", type: "uint256[]" },
        { name: "func", type: "bytes[]" },
        { name: "gasToken", type: "address" },
        { name: "gasFee", type: "uint256" },
        { name: "gasReceive", type: "address" },
        { name: "gasDeductBefore", type: "bool" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Execute",
    message: executeParams,
  });

  const callData = encodeFunctionData({
    abi: smartWalletAbi,
    functionName: "executeBatchByAdmin",
    args: [{ ...executeParams, ownerSignature }],
  });

  console.log("simulating executeBatchByAdmin via eth_call ...");
  await publicClient.call({
    account: sponsor.address,
    to: eoa.address,
    data: callData,
    stateOverride,
  });
  console.log("simulation OK (no revert)");

  // A delegation is permanent on-chain state — once the EOA already points
  // at this exact SmartWallet address, re-sending an authorizationList just
  // burns an extra ~12,500 gas (EIP-7702 PER_AUTH_BASE_COST) for no effect.
  // A plain tx to the EOA already executes the delegated code.
  const currentCode = (await publicClient.getCode({ address: eoa.address })) || "0x";
  const delegationDesignator = `0xef0100${smartWalletAddress.slice(2).toLowerCase()}`;
  const alreadyDelegated = currentCode.toLowerCase() === delegationDesignator;
  console.log("already delegated to target SmartWallet:", alreadyDelegated);

  // Signing the authorization is a local, offline operation (no network
  // effect, no on-chain nonce consumed until actually broadcast), so it's
  // safe to do this even in dry-run — needed to get an accurate gas estimate
  // since the authorizationList affects intrinsic gas.
  let authorization;
  if (!alreadyDelegated) {
    const authorizationNonce = await publicClient.getTransactionCount({
      address: eoa.address,
      blockTag: "pending",
    });
    authorization = await eoa.signAuthorization({
      address: smartWalletAddress,
      chainId,
      nonce: authorizationNonce,
    });
  }

  const txShape = {
    account: sponsor.address,
    to: eoa.address,
    data: callData,
    ...(authorization ? { authorizationList: [authorization] } : {}),
  };

  // The RPC's own eth_estimateGas is used, but with the exact same tx shape
  // (including authorizationList when present) so its EIP-7702 intrinsic-gas
  // accounting — whatever it is — matches what actually gets broadcast.
  // TX_GAS_LIMIT overrides this entirely if the estimate turns out unreliable.
  let gas;
  if (process.env.TX_GAS_LIMIT) {
    gas = BigInt(process.env.TX_GAS_LIMIT);
    console.log("gas (TX_GAS_LIMIT override):", gas.toString());
  } else {
    const estimated = await publicClient.estimateGas(txShape);
    gas = (estimated * 130n) / 100n; // 30% headroom
    console.log("gas (estimated + 30% headroom):", gas.toString(), "| raw estimate:", estimated.toString());
  }

  if (!broadcast) {
    console.log("BROADCAST is not \"true\" — dry-run only, nothing was sent on-chain.");
    return;
  }

  let hash;
  if (alreadyDelegated) {
    hash = await sponsorClient.sendTransaction({
      account: sponsor,
      to: eoa.address,
      data: callData,
      gas,
    });
  } else {
    hash = await sponsorClient.sendTransaction({
      account: sponsor,
      authorizationList: [authorization],
      to: eoa.address,
      data: callData,
      type: "eip7702",
      gas,
    });
  }
  console.log("broadcast tx hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log("status:", receipt.status, "| block:", receipt.blockNumber.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
