"use client";

import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, Package, TrendingUp } from "lucide-react";
import { ProductCard } from "@/components/dashboard/product-card";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { CreateProductForm } from "@/components/dashboard/create-product-form";
// @ts-ignore
import Draggable from "react-draggable";

export default function CreatorDashboard() {
  const dragNodeRef = useRef(null);

  const stats = [
    {
      title: "Total Revenue",
      value: "125.5 SOL",
      icon: DollarSign,
      change: "+12% from last month",
    },
    {
      title: "Active Products",
      value: "12",
      icon: Package,
      change: "+2 new this month",
    },
    {
      title: "Total Sales",
      value: "1,234",
      icon: TrendingUp,
      change: "+24% from last month",
    },
  ];

  const myProducts = [
    {
      id: 1,
      title: "Neon Cyberpunk 3D Pack",
      creator: "You",
      price: 1.5,
      imageUrl: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2940&auto=format&fit=crop",
      isOwned: true, // Just to show difference if needed, though for creator it implies ownership/management
    },
    {
      id: 2,
      title: "Lo-Fi Beats Collection Vol. 1",
      creator: "You",
      price: 0.8,
      imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2940&auto=format&fit=crop",
      isOwned: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Creator Studio</h1>
          <p className="text-zinc-400">Manage your products and track your performance.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#007DFC] hover:bg-[#0063ca] text-white shadow-[0_0_15px_-5px_#007DFC]">
              <Plus className="mr-2 h-4 w-4" /> Create New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-transparent border-none p-0 max-w-2xl shadow-none overflow-visible">
            <DialogTitle className="sr-only">Create New Product</DialogTitle>
            <Draggable handle=".drag-handle" nodeRef={dragNodeRef}>
              <div className="w-full" ref={dragNodeRef}>
                <CreateProductForm />
              </div>
            </Draggable>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-[#007DFC]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs text-zinc-500 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products Section */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">My Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {myProducts.map((product) => (
            <ProductCard
              key={product.id}
              title={product.title}
              creator={product.creator}
              price={product.price}
              imageUrl={product.imageUrl}
              isOwned={product.isOwned}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
