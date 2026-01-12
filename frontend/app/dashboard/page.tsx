"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/dashboard/product-card";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import axios from "axios";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  coverImage: string | null;
  creator: {
    id: string;
    name: string;
    image: string | null;
  };
  accessMintAddress: string | null;
  splitStateAddress: string | null;
}

export default function DiscoverPage() {
  const { publicKey, connected } = useWallet();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter products based on search query
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#007DFC]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Discover</h1>
          <p className="text-zinc-400">Explore the best digital assets from top creators.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border-zinc-800 text-white pl-10 focus-visible:ring-zinc-700"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">
            {searchQuery ? "No products found matching your search." : "No products available yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Link key={product.id} href={`/marketplace/${product.id}`}>
              <ProductCard
                title={product.name}
                creator={product.creator.name}
                price={product.price}
                imageUrl={product.coverImage || "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2940&auto=format&fit=crop"}
                creatorAvatar={product.creator.image || undefined}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
