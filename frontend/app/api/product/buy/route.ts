import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PAYMENT_ESCROW_PROGRAM_ID, ACCESS_MINT_PROGRAM_ID, DISTRIBUTION_PROGRAM_ID } from "@/lib/programs/constants";
import { deriveEscrowState, deriveAccessMintState, deriveAccessMintAuthority, deriveSplitState, hexToContentId, deriveEscrowVault, deriveDistributionVault } from "@/lib/programs/pdas";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

/**
 * API route to prepare buy transaction parameters
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, buyerWalletAddress } = await req.json();

    if (!productId || !buyerWalletAddress) {
      return NextResponse.json(
        { error: "Product ID and buyer wallet address are required" },
        { status: 400 }
      );
    }

    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { creator: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.accessMintAddress || !product.splitStateAddress || !product.contentId) {
      return NextResponse.json(
        { error: "Product not initialized on blockchain. Please wait for creator to initialize." },
        { status: 400 }
      );
    }

    if (!product.creator.walletAddress) {
      return NextResponse.json(
        { error: "Creator wallet address not set" },
        { status: 400 }
      );
    }

    const buyerPublicKey = new PublicKey(buyerWalletAddress);
    const creatorPublicKey = new PublicKey(product.creator.walletAddress);
    const accessMintPublicKey = new PublicKey(product.accessMintAddress);
    const splitStatePublicKey = new PublicKey(product.splitStateAddress);

    const contentId = hexToContentId(product.contentId);
    const seed = product.seed ? Number(product.seed) : 1;
    const priceInLamports = Math.round(product.price * 1_000_000_000);

    // Derive PDAs
    const [escrowStatePda] = deriveEscrowState(buyerPublicKey, contentId, seed);
    const [escrowVaultPda] = deriveEscrowVault(escrowStatePda);
    const [accessMintStatePda] = deriveAccessMintState(creatorPublicKey, contentId, seed);
    const [accessMintAuthorityPda] = deriveAccessMintAuthority(creatorPublicKey, contentId, seed);
    const [splitStatePda] = deriveSplitState(creatorPublicKey, contentId, seed);
    const [distributionVaultPda] = deriveDistributionVault(splitStatePda);

    // Verify PDAs match stored addresses
    if (accessMintStatePda.toString() !== product.accessMintAddress) {
      console.warn("Access mint PDA mismatch");
    }
    if (splitStatePda.toString() !== product.splitStateAddress) {
      console.warn("Split state PDA mismatch");
    }

    // Return buy parameters for frontend to call buy_and_mint
    return NextResponse.json({
      success: true,
      params: {
        programId: PAYMENT_ESCROW_PROGRAM_ID.toString(),
        paymentAmount: priceInLamports,
        accounts: {
          buyer: buyerPublicKey.toString(),
          creator: creatorPublicKey.toString(),
          contentId: Array.from(contentId),
          price: priceInLamports,
          // Escrow accounts
          escrowState: escrowStatePda.toString(),
          vault: escrowVaultPda.toString(),
          // Access mint accounts
          accessMintProgram: ACCESS_MINT_PROGRAM_ID.toString(),
          accessMintState: accessMintStatePda.toString(),
          accessMint: accessMintPublicKey.toString(),
          mintAuthority: accessMintAuthorityPda.toString(),
          // Distribution accounts
          distributionProgram: DISTRIBUTION_PROGRAM_ID.toString(),
          splitState: splitStatePda.toString(),
          distributionVault: distributionVaultPda.toString(), // Distribution vault (derived from split_state)
          platformTreasury: process.env.NEXT_PUBLIC_PLATFORM_TREASURY || "11111111111111111111111111111111",
        },
        seed,
        productId,
      },
    });
  } catch (error) {
    console.error("Failed to prepare buy transaction:", error);
    if (error instanceof Error && error.message.includes("Invalid public key")) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
