const { ethers, network } = require("hardhat");

// Comma-separated addresses to whitelist right after deploy. Optional —
// without ADMIN_ADDRESSES no relayer can call executeBatchByAdmin, and
// without GAS_RECEIVE_ADDRESSES no gasFee > 0 admin call can succeed.
function parseAddressList(envVar) {
  const raw = process.env[envVar] || "";
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const gasLimit = BigInt(process.env.DEPLOY_GAS_LIMIT || "3000000");

  const owner = process.env.REGISTRY_OWNER;
  if (!owner) throw new Error("REGISTRY_OWNER env var is required");

  console.log("network:", network.name);
  console.log("deployer:", deployer.address);
  console.log("balance:", ethers.formatEther(balance), "ETH");
  console.log("registry owner:", owner);

  const WalletRegistry = await ethers.getContractFactory("WalletRegistry");
  const registry = await WalletRegistry.deploy(owner, { gasLimit });
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("WalletRegistry deployed to:", registryAddr);

  const SmartWallet = await ethers.getContractFactory("SmartWallet");
  const smartWallet = await SmartWallet.deploy(registryAddr, { gasLimit });
  await smartWallet.waitForDeployment();
  console.log("SmartWallet deployed to:", await smartWallet.getAddress());

  const admins = parseAddressList("ADMIN_ADDRESSES");
  const gasReceives = parseAddressList("GAS_RECEIVE_ADDRESSES");

  if (admins.length || gasReceives.length) {
    if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
      console.log(
        "⚠️  Deployer is not the registry owner — skipping addAdmins/addGasReceives." +
          " Run them from the owner account separately."
      );
    } else {
      if (admins.length) {
        const tx = await registry.addAdmins(admins);
        await tx.wait();
        console.log("addAdmins:", admins);
      }
      if (gasReceives.length) {
        const tx = await registry.addGasReceives(gasReceives);
        await tx.wait();
        console.log("addGasReceives:", gasReceives);
      }
    }
  } else {
    console.log(
      "ℹ️  No ADMIN_ADDRESSES / GAS_RECEIVE_ADDRESSES set — executeBatchByAdmin" +
        " will revert until registry.addAdmins()/addGasReceives() are called by the owner."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
