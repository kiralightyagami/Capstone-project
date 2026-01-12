"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Image as ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { PAYMENT_ESCROW_PROGRAM_ID, ACCESS_MINT_PROGRAM_ID, DISTRIBUTION_PROGRAM_ID } from "@/lib/programs/constants";
import { deriveEscrowVault } from "@/lib/programs/pdas";
import { usePaymentEscrowProgram } from "@/lib/programs/use-payment-escrow";
import * as anchor from "@coral-xyz/anchor";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  coverImage: string | null;
  gdriveLink: string;
  creator: {
    id: string;
    name: string;
    image: string | null;
    walletAddress: string | null;
  };
  accessMintAddress: string | null;
  splitStateAddress: string | null;
  contentId: string | null;
  seed: bigint | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { program: paymentEscrowProgram, provider: paymentEscrowProvider } = usePaymentEscrowProgram();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (params.productId) {
      fetchProduct();
    }
  }, [params.productId]);

  const fetchProduct = async () => {
    try {
      // Fetch all products and find the one matching the ID
      const response = await axios.get("/api/product");
      const products = response.data.products || [];
      const found = products.find((p: Product) => p.id === params.productId);
      if (found) {
        setProduct(found);
      } else {
        console.error("Product not found");
      }
    } catch (error) {
      console.error("Failed to fetch product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!connected || !publicKey || !product) {
      return;
    }

    if (!product.accessMintAddress || !product.splitStateAddress || !product.contentId) {
      alert("Product not fully initialized on blockchain");
      return;
    }

    if (!paymentEscrowProgram || !paymentEscrowProvider) {
      alert("Payment program not available. Please try again later.");
      return;
    }

    setPurchasing(true);

    try {
      // Get buy parameters from API
      const response = await axios.post("/api/product/buy", {
        productId: product.id,
        buyerWalletAddress: publicKey.toString(),
      });

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to prepare purchase");
      }

      const { params: buyParams } = response.data;
      const contentId = Buffer.from(buyParams.accounts.contentId);

      // Get buyer's associated token account for the access mint
      const accessMint = new PublicKey(buyParams.accounts.accessMint);
      const buyerAccessTokenAccount = await getAssociatedTokenAddress(
        accessMint,
        publicKey
      );

      // Check if escrow already exists
      const escrowState = new PublicKey(buyParams.accounts.escrowState);
      let escrowExists = false;
      try {
        const accountInfo = await connection.getAccountInfo(escrowState);
        escrowExists = accountInfo !== null;
      } catch (error) {
        // Escrow doesn't exist
      }

      const tx = new Transaction();

      // Initialize escrow if it doesn't exist
      if (!escrowExists) {
        // Use paymentAmount (in lamports) for the price
        const priceInLamports = buyParams.paymentAmount || buyParams.accounts.price;
        if (!priceInLamports || priceInLamports <= 0) {
          throw new Error("Invalid product price");
        }

        const initializeEscrowIx = await paymentEscrowProgram.methods
          .initializeEscrow(
            Array.from(contentId),
            new anchor.BN(priceInLamports),
            null, // No SPL token payment, use SOL
            new anchor.BN(buyParams.seed)
          )
          .accounts({
            buyer: publicKey,
            creator: new PublicKey(buyParams.accounts.creator),
            escrowState: escrowState,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        
        tx.add(initializeEscrowIx);
      }

      // Get accounts for SOL payment
      const creatorPublicKey = new PublicKey(buyParams.accounts.creator);
      const platformTreasury = new PublicKey(buyParams.accounts.platformTreasury);
      const escrowVaultPda = new PublicKey(buyParams.accounts.vault);
      const distributionVaultPda = new PublicKey(buyParams.accounts.distributionVault);

      const buyAndMintIx = await paymentEscrowProgram.methods
        .buyAndMint(new anchor.BN(buyParams.paymentAmount))
        .accounts({
          buyer: publicKey,
          escrowState: escrowState,
          vault: escrowVaultPda, // Escrow vault (derived from escrow_state) - required by constraint
          // For SOL payments, these need to be the actual mutable accounts
          // The program will check if payment_token_mint is None to determine SOL vs SPL
          buyerTokenAccount: publicKey, // Buyer's wallet (mutable for SOL transfer)
          vaultTokenAccount: escrowVaultPda, // Escrow vault PDA (mutable for SOL transfer)
          tokenProgram: SystemProgram.programId, // Not used for SOL, but required
          // Access mint accounts
          accessMintProgram: new PublicKey(buyParams.accounts.accessMintProgram),
          accessMintState: new PublicKey(buyParams.accounts.accessMintState),
          accessMint: accessMint,
          mintAuthority: new PublicKey(buyParams.accounts.mintAuthority),
          buyerAccessTokenAccount: buyerAccessTokenAccount,
          accessTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          // Distribution accounts
          distributionProgram: new PublicKey(buyParams.accounts.distributionProgram),
          splitState: new PublicKey(buyParams.accounts.splitState),
          distributionVault: distributionVaultPda, // Distribution vault (derived from split_state)
          distributionVaultTokenAccount: distributionVaultPda, // For SOL, same as distribution vault
          platformTreasury: platformTreasury,
          // Additional accounts needed for distribution CPI
          creator: creatorPublicKey,
          paymentTokenMint: SystemProgram.programId, // SOL payment (System::id())
          // For SOL payments, these are the actual wallet accounts (mutable)
          creatorTokenAccount: creatorPublicKey, // Creator's wallet (mutable for SOL transfer)
          platformTreasuryTokenAccount: platformTreasury, // Platform treasury (mutable for SOL transfer)
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([]) // No collaborators for now
        .instruction();

      tx.add(buyAndMintIx);

      // Send and confirm transaction
      const signature = await paymentEscrowProvider.sendAndConfirm(tx);

      alert(`Purchase successful! Transaction: ${signature}`);
      
      // Refresh the page or redirect to library
      router.push("/dashboard/library");
    } catch (error) {
      console.error("Purchase error:", error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || "Failed to purchase product");
      } else if (error instanceof Error) {
        alert(`Purchase failed: ${error.message}`);
      } else {
        alert("Failed to purchase product. Please try again.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="text-center text-white space-y-4">
          <h2 className="text-2xl font-bold">Product not found</h2>
          <p className="text-zinc-400">The product you're looking for doesn't exist or has been removed.</p>
          <Link href="/marketplace">
            <Button className="bg-[#007DFC] hover:bg-[#0063ca] text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <Link href="/marketplace">
        <Button variant="ghost" className="mb-6 text-white hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="relative aspect-square w-full bg-zinc-900 rounded-lg overflow-hidden">
          {product.coverImage ? (
            <Image
              src={product.coverImage}
              alt={product.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-24 w-24 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">{product.name}</h1>
            <p className="text-2xl font-bold text-[#007DFC] mb-4">
              {product.price} SOL
            </p>
            <p className="text-zinc-400 mb-4">
              by {product.creator.name}
            </p>
          </div>

          <Card className="bg-zinc-900 border-zinc-800 text-white">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300 whitespace-pre-wrap">
                {product.description}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!connected ? (
              <div className="space-y-2">
                <p className="text-zinc-400 text-sm">Connect your wallet to purchase</p>
                <WalletConnectButton />
              </div>
            ) : product.accessMintAddress && product.splitStateAddress ? (
              <Button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full bg-[#007DFC] hover:bg-[#0063ca] text-white text-lg py-6"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Purchase for {product.price} SOL
                  </>
                )}
              </Button>
            ) : (
              <Button disabled className="w-full bg-zinc-800 text-zinc-500">
                Product Not Available
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
