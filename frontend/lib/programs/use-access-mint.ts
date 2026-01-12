"use client";

import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { useMemo } from "react";
import { useConnection, useWallet, type AnchorWallet } from "@solana/wallet-adapter-react";
import { ACCESS_MINT_PROGRAM_ID } from "./constants";
import accessMintIdl from "../../../access-mint/target/idl/access_mint.json";

/**
 * Hook to get Access Mint program instance
 */
export function useAccessMintProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet || !wallet.publicKey || typeof wallet.signTransaction !== "function" || typeof wallet.signAllTransactions !== "function") {
      return null;
    }

    return new AnchorProvider(connection, wallet as AnchorWallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;

    try {
      return new Program(accessMintIdl as Idl, provider);
    } catch (error) {
      console.warn("Failed to load Access Mint IDL:", error);
      return null;
    }
  }, [provider]);

  return { program, provider, programId: ACCESS_MINT_PROGRAM_ID };
}
