/**
 * ForgeContract — ethers.js v6 wrapper around the FORGE ERC-20 token contract.
 *
 * The wallet held here must carry MINTER_ROLE on the deployed contract.
 * All values exposed externally use human-readable ether strings to avoid
 * BigInt leaking into callers.
 *
 * NEXUS — Orchestration Agent (connecting SEALFORGE Node 1 → FORGE Node 2)
 */

import { ethers } from 'ethers'
import { FORGE_ABI } from './abi'

export class ForgeContract {
  private contract: ethers.Contract
  private signer: ethers.Wallet

  constructor() {
    const rpc = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org'

    const pk = process.env.TREASURY_PRIVATE_KEY
    if (!pk) throw new Error('[NEXUS] TREASURY_PRIVATE_KEY not set')

    const addr = process.env.FORGE_CONTRACT_ADDRESS
    if (!addr) throw new Error('[NEXUS] FORGE_CONTRACT_ADDRESS not set')

    const provider = new ethers.JsonRpcProvider(rpc)
    this.signer = new ethers.Wallet(pk, provider)
    this.contract = new ethers.Contract(addr, FORGE_ABI, this.signer)
  }

  /**
   * Returns true if the given WORM entry hash has already triggered a mint.
   */
  async isConsumed(wormHash: string): Promise<boolean> {
    const result: boolean = await this.contract.wormEntryMinted(wormHash)
    return result
  }

  /**
   * Calls wormMint on the FORGE contract.
   * @param recipient  - checksummed Ethereum address to receive tokens
   * @param amountEther - amount as a decimal ether string, e.g. "0.01"
   * @param wormHash   - bytes32 hex string derived from the WORM chainHash
   * @returns transaction hash
   */
  async mint(
    recipient: string,
    amountEther: string,
    wormHash: string,
  ): Promise<string> {
    const amount = ethers.parseEther(amountEther)
    const tx: ethers.TransactionResponse = await this.contract.wormMint(
      recipient,
      amount,
      wormHash,
    )
    await tx.wait()
    return tx.hash
  }

  /**
   * Returns how many tokens (as an ether string) can still be minted.
   */
  async remainingMintable(): Promise<string> {
    const raw: bigint = await this.contract.remainingMintable()
    return ethers.formatEther(raw)
  }
}
