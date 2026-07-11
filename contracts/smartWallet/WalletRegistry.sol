// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WalletRegistry
 * @notice Platform-wide configuration for the EIP-7702 V3 wallet.
 */
contract WalletRegistry is Ownable {
    bool public paused;
    mapping(address => bool) public adminAllowed;
    mapping(address => bool) public gasReceiveAllowed;

    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event AdminAdded(address indexed addr);
    event AdminRemoved(address indexed addr);
    event GasReceiveAdded(address indexed addr);
    event GasReceiveRemoved(address indexed addr);

    constructor(address initialOwner) Ownable(initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
    }

    /// @dev Disabled. If ownership were renounced, pause/unpause/allow-list
    ///      management would become permanently unreachable, destroying the
    ///      platform's only emergency-response surface over all V3-delegated
    ///      EOAs. A single fat-finger multisig proposal could otherwise brick
    ///      the whole user base.
    function renounceOwnership() public view override onlyOwner {
        revert("Ownership not renounceable");
    }

    // ───── Global pause ─────

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ───── admin allow-list ─────

    function addAdmin(address addr) external onlyOwner {
        _addAdmin(addr);
    }

    function addAdmins(address[] calldata addrs) external onlyOwner {
        uint256 n = addrs.length;
        for (uint256 i = 0; i < n;) {
            _addAdmin(addrs[i]);
            unchecked { ++i; }
        }
    }

    function removeAdmin(address addr) external onlyOwner {
        _removeAdmin(addr);
    }

    function removeAdmins(address[] calldata addrs) external onlyOwner {
        uint256 n = addrs.length;
        for (uint256 i = 0; i < n;) {
            _removeAdmin(addrs[i]);
            unchecked { ++i; }
        }
    }

    function _addAdmin(address addr) internal {
        require(addr != address(0), "Invalid address");
        adminAllowed[addr] = true;
        emit AdminAdded(addr);
    }

    function _removeAdmin(address addr) internal {
        delete adminAllowed[addr];
        emit AdminRemoved(addr);
    }

    // ───── gasReceive allow-list ─────

    function addGasReceive(address addr) external onlyOwner {
        _addGasReceive(addr);
    }

    function addGasReceives(address[] calldata addrs) external onlyOwner {
        uint256 n = addrs.length;
        for (uint256 i = 0; i < n;) {
            _addGasReceive(addrs[i]);
            unchecked { ++i; }
        }
    }

    function removeGasReceive(address addr) external onlyOwner {
        _removeGasReceive(addr);
    }

    function removeGasReceives(address[] calldata addrs) external onlyOwner {
        uint256 n = addrs.length;
        for (uint256 i = 0; i < n;) {
            _removeGasReceive(addrs[i]);
            unchecked { ++i; }
        }
    }

    function _addGasReceive(address addr) internal {
        require(addr != address(0), "Invalid address");
        gasReceiveAllowed[addr] = true;
        emit GasReceiveAdded(addr);
    }

    function _removeGasReceive(address addr) internal {
        delete gasReceiveAllowed[addr];
        emit GasReceiveRemoved(addr);
    }
}
