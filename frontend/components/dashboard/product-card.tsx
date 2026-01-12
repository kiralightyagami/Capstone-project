"use client";

import Image from "next/image";
import { Star, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface ProductCardProps {
  title: string;
  creator: string;
  price: number | string;
  imageUrl: string;
  isOwned?: boolean;
  rating?: number;
  ratingCount?: number;
  creatorAvatar?: string;
}

export function ProductCard({
  title,
  creator,
  price,
  imageUrl,
  isOwned = false,
  rating = 4.8,
  ratingCount = 120,
  creatorAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator}`,
}: ProductCardProps) {
  // Format price for display
  const displayPrice = typeof price === "number" 
    ? `${price} SOL` 
    : price;

  return (
    <div className="flex flex-col gap-0 group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all duration-300 cursor-pointer h-full">
      {/* Image Container */}
      <div className="aspect-square relative overflow-hidden bg-zinc-800">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Title */}
        <h3 className="font-bold text-white text-lg leading-tight mb-2 group-hover:text-[#007DFC] transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Creator Row */}
        <div className="flex items-center gap-2 mb-1">
          <div className="relative w-5 h-5 rounded-full overflow-hidden bg-zinc-800">
            <Image 
              src={creatorAvatar} 
              alt={creator} 
              fill 
              className="object-cover" 
            />
          </div>
          <span className="text-white text-sm underline hover:text-[#007DFC] transition-colors truncate">
            {creator}
          </span>
        </div>
        
        {/* Rating Row */}
        <div className="flex items-center gap-1 mb-2">
          <Star className="w-4 h-4 fill-white text-white" />
          <span className="text-white font-medium text-sm">{rating}</span>
          <span className="text-zinc-400 text-sm">({ratingCount})</span>
        </div>
      </div>

      {/* Footer with Price Tag & Buy Button */}
      <div className="border-t border-zinc-800 p-4 pt-4 mt-auto bg-zinc-900/50 flex items-center justify-between">
        <div 
          className="relative bg-white text-black font-bold text-base px-3 py-1 pr-6 inline-block"
          style={{
            clipPath: 'polygon(0% 0%, 100% 0%, 85% 50%, 100% 100%, 0% 100%)'
          }}
        >
          {isOwned ? "Owned" : displayPrice}
        </div>
        
        <div className="bg-white hover:bg-zinc-200 text-black font-bold h-9 px-4 text-sm rounded-md flex items-center justify-center cursor-pointer transition-colors">
          {isOwned ? (
            <><Download className="mr-2 h-3.5 w-3.5" /> Download</>
          ) : (
            "Buy"
          )}
        </div>
      </div>
    </div>
  );
}
