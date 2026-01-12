"use client";

import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { useMemo } from "react";
import { useConnection, useWallet, type AnchorWallet } from "@solana/wallet-adapter-react";
import { PAYMENT_ESCROW_PROGRAM_ID } from "./constants";
import paymentEscrowIdl from "../../../payment-escrow/target/idl/payment_escrow.json";

/**
 * Hook to get Payment Escrow program instance
 */
export function usePaymentEscrowProgram() {
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
      return new Program(paymentEscrowIdl as Idl, provider);
    } catch (error) {
      console.warn("Failed to load Payment Escrow IDL:", error);
      return null;
    }
  }, [provider]);

  return { program, provider, programId: PAYMENT_ESCROW_PROGRAM_ID };
}
