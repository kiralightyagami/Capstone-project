import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is a creator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "CREATOR") {
      return NextResponse.json(
        { error: "Only creators can create products" },
        { status: 403 }
      );
    }

    const { name, description, price, coverImage, gdriveLink } = await req.json();

    // Validate required fields
    if (!name || !description || !price || !gdriveLink) {
      return NextResponse.json(
        { error: "Name, description, price, and Google Drive link are required" },
        { status: 400 }
      );
    }

    // Validate price
    if (typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "Price must be a positive number" },
        { status: 400 }
      );
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        coverImage: coverImage || null,
        gdriveLink,
        creatorId: session.user.id,
      },
    });

    // Convert BigInt to string for JSON serialization
    const productResponse = {
      ...product,
      seed: product.seed?.toString() ?? null,
    };

    return NextResponse.json({ 
      success: true,
      product: productResponse
    });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    const accessMints = searchParams.get("accessMints"); // Comma-separated list of mint addresses

    // Build where clause
    let where: any = {};
    
    if (creatorId) {
      where.creatorId = creatorId;
    }

    // If accessMints is provided, filter by access mint addresses
    if (accessMints) {
      const mintAddresses = accessMints.split(",").filter(Boolean);
      where.accessMintAddress = {
        in: mintAddresses,
      };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            walletAddress: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Convert BigInt to string for JSON serialization
    const productsResponse = products.map(product => ({
      ...product,
      seed: product.seed?.toString() ?? null,
    }));

    return NextResponse.json({ products: productsResponse });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
