"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Image as ImageIcon, Package, Loader2, Link } from "lucide-react";
import Image from "next/image";
import axios from "axios";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  coverImage: string | null;
  gdriveLink: string;
  accessMintAddress: string | null;
  creator: {
    id: string;
    name: string;
    image: string | null;
  };
}

export default function LibraryPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPurchasedProducts();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey]);

  const fetchPurchasedProducts = async () => {
    if (!publicKey || !connection) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get all token accounts owned by the user's wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      );

      // Extract mint addresses from token accounts
      const ownedMintAddresses = tokenAccounts.value
        .filter((account) => {
          // Check if the account has a balance > 0
          const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
          return balance > 0;
        })
        .map((account) => account.account.data.parsed.info.mint);

      if (ownedMintAddresses.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Fetch all products with access mints that match owned tokens
      const response = await axios.get("/api/product", {
        params: {
          accessMints: ownedMintAddresses.join(","),
        },
      });

      // Filter products where user owns the access token
      const purchasedProducts = response.data.products.filter((product: Product) =>
        product.accessMintAddress && ownedMintAddresses.includes(product.accessMintAddress)
      );

      setProducts(purchasedProducts);
    } catch (error) {
      console.error("Failed to fetch purchased products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your library...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <Package className="h-16 w-16 text-zinc-600" />
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-zinc-400 mb-6">
              Connect your wallet to view your purchased digital assets
            </p>
            <WalletConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">My Library</h1>
          <p className="text-zinc-400">Your purchased digital assets</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg mb-2">No purchases yet</p>
          <p className="text-zinc-500 text-sm mb-6">
            Start browsing the marketplace to discover digital assets
          </p>
          <Button asChild className="bg-[#007DFC] hover:bg-[#0063ca]">
            <Link href="/marketplace">Browse Marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="bg-zinc-900 border-zinc-800 text-white overflow-hidden">
              <CardHeader className="p-0">
                <div className="relative aspect-video w-full bg-zinc-800">
                  {product.coverImage ? (
                    <Image
                      src={product.coverImage}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-zinc-600" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg mb-2 line-clamp-1">{product.name}</CardTitle>
                <CardDescription className="text-zinc-400 text-sm line-clamp-2">
                  {product.description}
                </CardDescription>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-zinc-700 text-white hover:bg-zinc-800"
                >
                  <a href={product.gdriveLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Access Content
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
