"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, Package, TrendingUp, Loader2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { CreateProductForm } from "@/components/dashboard/create-product-form";
import { useSession } from "@/lib/auth-client";
import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";
const Draggable = dynamic(() => import("react-draggable"), { ssr: false });

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  coverImage: string | null;
  gdriveLink: string;
  accessMintAddress: string | null;
  splitStateAddress: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    image: string | null;
  };
}

export default function CreatorDashboard() {
  const dragNodeRef = useRef(null);
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: "0 SOL",
    activeProducts: 0,
    totalSales: 0,
  });

  const fetchProducts = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get("/api/product", {
        params: {
          creatorId: session.user.id,
        },
      });

      const fetchedProducts = response.data.products || [];
      setProducts(fetchedProducts);

      // Calculate stats
      const activeProducts = fetchedProducts.filter(
        (p: Product) => p.accessMintAddress && p.splitStateAddress
      ).length;

      // Fetch revenue and sales from blockchain
      try {
        const statsResponse = await axios.get("/api/creator/stats");
        const { totalRevenue, totalSales } = statsResponse.data;

        setStats({
          totalRevenue: totalRevenue > 0 ? `${totalRevenue.toFixed(2)} SOL` : "0 SOL",
          activeProducts,
          totalSales: totalSales || 0,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        // Fallback to zero if stats API fails
        setStats({
          totalRevenue: "0 SOL",
          activeProducts,
          totalSales: 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [session, fetchProducts]);

  const handleProductCreated = () => {
    // Refresh products after creation
    setDialogOpen(false);
    fetchProducts();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Creator Studio</h1>
          <p className="text-zinc-400">Manage your products and track your performance.</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#007DFC] hover:bg-[#0063ca] text-white shadow-[0_0_15px_-5px_#007DFC]">
              <Plus className="mr-2 h-4 w-4" /> Create New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-transparent border-none p-0 max-w-2xl shadow-none overflow-visible">
            <DialogTitle className="sr-only">Create New Product</DialogTitle>
            <Draggable handle=".drag-handle" nodeRef={dragNodeRef}>
              <div className="w-full" ref={dragNodeRef}>
                <CreateProductForm onSuccess={handleProductCreated} />
              </div>
            </Draggable>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-[#007DFC]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalRevenue}</div>
            <p className="text-xs text-zinc-500 mt-1">All time earnings</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Active Products
            </CardTitle>
            <Package className="h-4 w-4 text-[#007DFC]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.activeProducts}</div>
            <p className="text-xs text-zinc-500 mt-1">
              {products.length} total products
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total Sales
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#007DFC]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalSales}</div>
            <p className="text-xs text-zinc-500 mt-1">All time purchases</p>
          </CardContent>
        </Card>
      </div>

      {/* Products Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">My Products</h2>
          {products.length > 0 && (
            <span className="text-sm text-zinc-400">
              {products.length} {products.length === 1 ? "product" : "products"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#007DFC]" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-lg">
            <Package className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg mb-2">No products yet</p>
            <p className="text-zinc-500 text-sm mb-6">
              Create your first product to start selling digital assets
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card
                key={product.id}
                className="bg-zinc-900 border-zinc-800 text-white overflow-hidden hover:border-zinc-700 transition-all group"
              >
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
                  {product.accessMintAddress && product.splitStateAddress && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      Active
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <CardTitle className="text-lg mb-2 line-clamp-1 group-hover:text-[#007DFC] transition-colors">
                    {product.name}
                  </CardTitle>
                  <p className="text-zinc-400 text-sm line-clamp-2 mb-3">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-[#007DFC]">
                      {product.price} SOL
                    </span>
                    {!product.accessMintAddress && (
                      <span className="text-xs text-yellow-500">Not initialized</span>
                    )}
                  </div>
                </CardContent>
                <div className="p-4 pt-0 flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <Link href={`/marketplace/${product.id}`}>
                      View
                    </Link>
                  </Button>
                  {product.gdriveLink && (
                    <Button
                      asChild
                      variant="outline"
                      className="border-zinc-700 text-white hover:bg-zinc-800"
                    >
                      <a href={product.gdriveLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
