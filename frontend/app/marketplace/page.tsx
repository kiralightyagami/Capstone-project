"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useWallet } from "@solana/wallet-adapter-react";

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
  };
  accessMintAddress: string | null;
  splitStateAddress: string | null;
}

export default function MarketplacePage() {
  const { publicKey, connected } = useWallet();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("/api/product");
      const allProducts = response.data.products || [];
      // Only show products that are initialized on blockchain (ready for purchase)
      const availableProducts = allProducts.filter(
        (p: Product) => p.accessMintAddress && p.splitStateAddress
      );
      setProducts(availableProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#007DFC] mb-4"></div>
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Marketplace</h1>
          <p className="text-zinc-400">Discover and purchase digital assets</p>
        </div>
        <WalletConnectButton />
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">No products available yet</p>
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
                <CardTitle className="text-lg mb-2 line-clamp-1 hover:text-[#007DFC] transition-colors">
                  {product.name}
                </CardTitle>
                <div className="flex items-center gap-2 mb-2">
                  {product.creator.image ? (
                    <Image
                      src={product.creator.image}
                      alt={product.creator.name}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-zinc-700" />
                  )}
                  <span className="text-xs text-zinc-400">{product.creator.name}</span>
                </div>
                <CardDescription className="text-zinc-400 text-sm line-clamp-2 mb-3">
                  {product.description}
                </CardDescription>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-[#007DFC]">
                    {product.price} SOL
                  </span>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Link href={`/marketplace/${product.id}`} className="w-full">
                  <Button className="w-full bg-[#007DFC] hover:bg-[#0063ca] text-white">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Now
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
