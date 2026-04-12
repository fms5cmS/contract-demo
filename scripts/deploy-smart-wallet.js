const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const gasLimit = BigInt(process.env.DEPLOY_GAS_LIMIT || "3000000");

  console.log("network:", network.name);
  console.log("deployer:", deployer.address);
  console.log("balance:", ethers.formatEther(balance), "ETH");
  console.log("gasLimit:", gasLimit.toString());

  const SmartWallet = await ethers.getContractFactory("SmartWallet");
  const smartWallet = await SmartWallet.deploy({ gasLimit });
  await smartWallet.waitForDeployment();

  console.log("SmartWallet deployed to:", await smartWallet.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
