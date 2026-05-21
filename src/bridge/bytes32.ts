/**
 * Canonical bytes32 derivation for WORM chainHash → Solidity bytes32.
 * Used by all settlement engines — single source of truth.
 *
 * Derivation: sha256(chainHash_hex_bytes) → keccak256 → bytes32
 * This produces a stable, collision-resistant 32-byte key for the
 * on-chain wormEntryMinted mapping.
 *
 * NEXUS — Orchestration Agent
 */

import * as crypto from 'crypto'
import { ethers } from 'ethers'

/**
 * Convert a WORM chainHash (64-char hex HMAC-SHA256) to a Solidity bytes32.
 * Throws if chainHash is not a valid 64-char hex string.
 */
export function toBytes32(chainHash: string): string {
  if (!/^[0-9a-f]{64}$/i.test(chainHash)) {
    throw new Error(`[BRIDGE] Invalid chainHash — expected 64-char hex, got: ${chainHash.slice(0, 20)}...`)
  }
  const raw = Buffer.from(chainHash, 'hex')
  const sha = crypto.createHash('sha256').update(raw).digest()
  return ethers.keccak256(sha)
}
