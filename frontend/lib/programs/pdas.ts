import { PublicKey } from "@solana/web3.js";
import { ACCESS_MINT_PROGRAM_ID, PAYMENT_ESCROW_PROGRAM_ID, DISTRIBUTION_PROGRAM_ID } from "./constants";

/**
 * Derive access mint state PDA
 */
export function deriveAccessMintState(
  creator: PublicKey,
  contentId: Uint8Array | Buffer,
  seed: number | bigint,
  programId: PublicKey = ACCESS_MINT_PROGRAM_ID
): [PublicKey, number] {
  const seedBuffer = Buffer.allocUnsafe(8);
  seedBuffer.writeBigUInt64LE(BigInt(seed), 0);
  
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("access_mint_state"),
      creator.toBuffer(),
      Buffer.from(contentId),
      seedBuffer,
    ],
    programId
  );
}

/**
 * Derive access mint authority PDA
 */
export function deriveAccessMintAuthority(
  creator: PublicKey,
  contentId: Uint8Array | Buffer,
  seed: number | bigint,
  programId: PublicKey = ACCESS_MINT_PROGRAM_ID
): [PublicKey, number] {
  const seedBuffer = Buffer.allocUnsafe(8);
  seedBuffer.writeBigUInt64LE(BigInt(seed), 0);
  
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("access_mint_authority"),
      creator.toBuffer(),
      Buffer.from(contentId),
      seedBuffer,
    ],
    programId
  );
}

/**
 * Derive escrow state PDA
 */
export function deriveEscrowState(
  buyer: PublicKey,
  contentId: Uint8Array | Buffer,
  seed: number | bigint,
  programId: PublicKey = PAYMENT_ESCROW_PROGRAM_ID
): [PublicKey, number] {
  const seedBuffer = Buffer.allocUnsafe(8);
  seedBuffer.writeBigUInt64LE(BigInt(seed), 0);
  
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      buyer.toBuffer(),
      Buffer.from(contentId),
      seedBuffer,
    ],
    programId
  );
}

/**
 * Derive escrow vault PDA
 */
export function deriveEscrowVault(
  escrowState: PublicKey,
  programId: PublicKey = PAYMENT_ESCROW_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrowState.toBuffer()],
    programId
  );
}

/**
 * Derive split state PDA
 */
export function deriveSplitState(
  creator: PublicKey,
  contentId: Uint8Array | Buffer,
  seed: number | bigint,
  programId: PublicKey = DISTRIBUTION_PROGRAM_ID
): [PublicKey, number] {
  const seedBuffer = Buffer.allocUnsafe(8);
  seedBuffer.writeBigUInt64LE(BigInt(seed), 0);
  
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("split"), // Must match SplitState::SEED_PREFIX in Rust
      creator.toBuffer(),
      Buffer.from(contentId),
      seedBuffer,
    ],
    programId
  );
}

/**
 * Derive distribution vault PDA from split_state
 * Seeds: [b"vault", split_state.key().as_ref()]
 */
export function deriveDistributionVault(
  splitState: PublicKey,
  programId: PublicKey = DISTRIBUTION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), splitState.toBuffer()],
    programId
  );
}

/**
 * Convert hex string to Uint8Array (32 bytes for content ID)
 */
export function hexToContentId(hex: string): Buffer {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const buf = Buffer.from(cleanHex, "hex");
  
  if (buf.length !== 32) {
    throw new Error(`Content ID must be 32 bytes (64 hex chars), got ${buf.length} bytes`);
  }
  
  return buf;
}

/**
 * Convert content ID (Uint8Array) to hex string
 */
export function contentIdToHex(contentId: Uint8Array | Buffer): string {
  return Buffer.from(contentId).toString("hex");
}
