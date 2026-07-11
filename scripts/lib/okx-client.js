const crypto = require("crypto");

const OKX_BASE_URL = "https://web3.okx.com";

// OKX's placeholder for the chain's native token (ETH). Not the same as
// Solidity's address(0) convention used by SmartWallet's gasToken param —
// callers must convert between the two.
const OKX_NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

function sign({ timestamp, method, requestPath, body, secret }) {
  const prehash = `${timestamp}${method}${requestPath}${body || ""}`;
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64");
}

async function okxRequest({ method, path, query, creds }) {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "")).toString()
    : "";
  const requestPath = path + qs;
  const timestamp = new Date().toISOString();
  const signature = sign({ timestamp, method, requestPath, secret: creds.secret });

  const res = await fetch(OKX_BASE_URL + requestPath, {
    method,
    headers: {
      "OK-ACCESS-KEY": creds.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": creds.passphrase,
      "OK-ACCESS-PROJECT": creds.project,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();
  if (json.code !== "0") {
    throw new Error(`OKX API error [${path}]: code=${json.code} msg=${json.msg}`);
  }
  return json.data;
}

async function getSupportedChains(creds) {
  return okxRequest({
    method: "GET",
    path: "/api/v6/dex/aggregator/supported/chain",
    creds,
  });
}

async function getApproveTransaction(creds, { chainIndex, tokenContractAddress, approveAmount }) {
  const [data] = await okxRequest({
    method: "GET",
    path: "/api/v6/dex/aggregator/approve-transaction",
    query: { chainIndex, tokenContractAddress, approveAmount },
    creds,
  });
  return data;
}

async function getSwap(
  creds,
  { chainIndex, fromTokenAddress, toTokenAddress, amount, slippagePercent, userWalletAddress, swapReceiverAddress }
) {
  const [data] = await okxRequest({
    method: "GET",
    path: "/api/v6/dex/aggregator/swap",
    query: {
      chainIndex,
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippagePercent,
      userWalletAddress,
      swapReceiverAddress,
    },
    creds,
  });
  return data;
}

module.exports = {
  OKX_NATIVE_TOKEN_ADDRESS,
  getSupportedChains,
  getApproveTransaction,
  getSwap,
};
