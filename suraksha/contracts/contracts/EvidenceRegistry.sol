// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ─────────────────────────────────────────────
//  Suraksha — EvidenceRegistry.sol
//  Stores SHA-256 hashes on-chain with a timestamp.
//  Deployed on Polygon Mumbai testnet.
// ─────────────────────────────────────────────

contract EvidenceRegistry {

    // ── Events ────────────────────────────────
    event HashStored(
        bytes32 indexed hash,
        address indexed submitter,
        uint256 timestamp
    );

    // ── Data ──────────────────────────────────
    struct EvidenceRecord {
        address submitter;   // wallet that called storeHash
        uint256 timestamp;   // block timestamp at submission
        bool    exists;      // guard against zero-value lookup
    }

    // hash → record
    mapping(bytes32 => EvidenceRecord) private registry;

    // ── Store ─────────────────────────────────
    /**
     * @notice Timestamp a SHA-256 hash on-chain.
     * @dev    hash must be the raw bytes32 SHA-256 digest
     *         (not hex string — convert in JS before calling).
     * @param  hash  bytes32 SHA-256 digest of the evidence file
     */
    function storeHash(bytes32 hash) external {
        require(hash != bytes32(0),        "Empty hash");
        require(!registry[hash].exists,    "Hash already registered");

        registry[hash] = EvidenceRecord({
            submitter: msg.sender,
            timestamp: block.timestamp,
            exists:    true
        });

        emit HashStored(hash, msg.sender, block.timestamp);
    }

    // ── Verify ────────────────────────────────
    /**
     * @notice Check if a hash has been registered.
     * @param  hash  bytes32 SHA-256 digest
     * @return exists     true if registered
     * @return submitter  address that registered it
     * @return timestamp  Unix timestamp of registration
     */
    function verifyHash(bytes32 hash)
        external
        view
        returns (bool exists, address submitter, uint256 timestamp)
    {
        EvidenceRecord memory r = registry[hash];
        return (r.exists, r.submitter, r.timestamp);
    }
}