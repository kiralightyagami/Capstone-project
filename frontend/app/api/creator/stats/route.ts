import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { Connection, PublicKey } from "@solana/web3.js";
import { PAYMENT_ESCROW_PROGRAM_ID } from "@/lib/programs/constants";
import { clusterApiUrl } from "@solana/web3.js";

/**
 * API route to calculate creator stats from blockchain data
 * Queries payment escrow program for completed transactions
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with wallet address
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletAddress: true },
    });

    if (!user || !user.walletAddress) {
      // Return zero stats if no wallet connected
      return NextResponse.json({
        totalRevenue: 0,
        totalSales: 0,
      });
    }

    const creatorPublicKey = new PublicKey(user.walletAddress);
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet"),
      "confirmed"
    );

    try {
      // Query all escrow accounts from payment escrow program
      // We'll filter by creator in code since memcmp requires base58 encoding
      // EscrowState structure: discriminator(8) + buyer(32) + creator(32) + ...
      const creatorPublicKeyBytes = creatorPublicKey.toBytes();
      
      // Get all escrow accounts (we'll filter by creator in code)
      // Note: This queries all escrows - in production, consider pagination or indexing
      const allEscrowAccounts = await connection.getProgramAccounts(
        PAYMENT_ESCROW_PROGRAM_ID
      );

      let totalRevenue = 0;
      let totalSales = 0;

      // Parse escrow accounts
      // EscrowState layout (from Rust):
      // discriminator: 8 bytes (offset 0)
      // buyer: Pubkey 32 bytes (offset 8)
      // creator: Pubkey 32 bytes (offset 40)
      // content_id: [u8; 32] 32 bytes (offset 72)
      // price: u64 8 bytes (offset 104)
      // payment_token_mint: Option<Pubkey> 1 + 32 = 33 bytes (offset 112)
      // payment_amount: u64 8 bytes (offset 145)
      // access_mint_address: Option<Pubkey> 1 + 32 = 33 bytes (offset 153)
      // created_ts: i64 8 bytes (offset 186)
      // seed: u64 8 bytes (offset 194)
      // status: EscrowStatus enum 1 byte (offset 202)
      // bump: u8 1 byte (offset 203)

      // Parse escrow accounts and filter by creator
      for (const account of allEscrowAccounts) {
        try {
          const data = Buffer.from(account.account.data);
          
          // Check if we have enough data (minimum 203 bytes for full EscrowState)
          if (data.length < 203) continue;
          
          // Check if creator matches (offset 40, 32 bytes)
          const creatorOffset = 40;
          const accountCreatorBytes = data.slice(creatorOffset, creatorOffset + 32);
          const creatorMatches = Buffer.from(creatorPublicKeyBytes).equals(accountCreatorBytes);
          
          if (!creatorMatches) continue;
          
          // Check status (Completed = 1, Initialized = 0, Cancelled = 2)
          const statusOffset = 202;
          const status = data[statusOffset];
          
          // Status 1 = Completed (EscrowStatus::Completed)
          if (status === 1) {
            totalSales++;
            
            // Read payment_amount (offset 145: 8 + 32 + 32 + 32 + 8 + 33 = 145)
            const paymentAmountOffset = 145;
            const paymentAmountBuffer = data.slice(
              paymentAmountOffset,
              paymentAmountOffset + 8
            );
            // Convert little-endian u64 to number
            const paymentAmount = Number(
              paymentAmountBuffer.readBigUInt64LE(0)
            );
            totalRevenue += paymentAmount;
          }
        } catch (error) {
          // Skip accounts that can't be parsed
          console.warn("Failed to parse escrow account:", error);
        }
      }

      // Convert lamports to SOL
      const totalRevenueSOL = totalRevenue / 1_000_000_000;

      return NextResponse.json({
        totalRevenue: totalRevenueSOL,
        totalSales,
      });
    } catch (error) {
      console.error("Failed to query blockchain for stats:", error);
      // Return zero stats on error (program might not be deployed yet)
      return NextResponse.json({
        totalRevenue: 0,
        totalSales: 0,
      });
    }
  } catch (error) {
    console.error("Failed to get creator stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
