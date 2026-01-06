import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PaymentEscrow } from "../target/types/payment_escrow";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("Payment Escrow Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PaymentEscrow as Program<PaymentEscrow>;

  let buyer: Keypair;
  let creator: Keypair;

  const contentId = Array.from({ length: 32 }, (_, i) => i + 1);
  const price = new anchor.BN(1 * LAMPORTS_PER_SOL);
  
  // Helper to generate unique seed
  const getUniqueSeed = () => new anchor.BN(Date.now() + Math.floor(Math.random() * 1000));

  before(async () => {
    buyer = (provider.wallet as anchor.Wallet).payer;
    creator = Keypair.generate();

    // Airdrop SOL to creator
    const airdropSig = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    console.log("Test accounts initialized");
    console.log("Program ID:", program.programId.toString());
  });

  describe("Initialize Escrow", () => {
    let escrowPda: PublicKey;

    it("Should initialize escrow for SOL payment", async () => {
      const seed = getUniqueSeed();
      
      // Derive escrow PDA
      [escrowPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyer.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const tx = await program.methods
        .initializeEscrow(contentId, price, null, seed)
        .accountsPartial({
          buyer: buyer.publicKey,
          creator: creator.publicKey,
          escrowState: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Escrow initialized");
      console.log("Transaction:", tx);

      // Fetch and verify escrow state
      const escrowState = await program.account.escrowState.fetch(escrowPda);

      expect(escrowState.buyer.toString()).to.equal(buyer.publicKey.toString());
      expect(escrowState.creator.toString()).to.equal(creator.publicKey.toString());
      expect(escrowState.price.toString()).to.equal(price.toString());
      expect(escrowState.paymentAmount.toNumber()).to.equal(0);
      expect(escrowState.paymentTokenMint).to.be.null;
      expect(escrowState.seed.toString()).to.equal(seed.toString());

      console.log("Escrow created on-chain");
      console.log("Price:", escrowState.price.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("Status: Initialized");
    });

    it("Should initialize escrow with different seed for same buyer/content", async () => {
      const seed2 = getUniqueSeed();

      const [escrowPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyer.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .initializeEscrow(contentId, price, null, seed2)
        .accountsPartial({
          buyer: buyer.publicKey,
          creator: creator.publicKey,
          escrowState: escrowPda2,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Verify both escrows exist and have different seeds
      const escrow1 = await program.account.escrowState.fetch(escrowPda);
      const escrow2 = await program.account.escrowState.fetch(escrowPda2);

      // Seeds should be different
      expect(escrow1.seed.toString()).to.not.equal(escrow2.seed.toString());
      
      // Both should be for same buyer and creator
      expect(escrow1.buyer.toString()).to.equal(escrow2.buyer.toString());
      expect(escrow1.creator.toString()).to.equal(escrow2.creator.toString());

      console.log("Multiple escrows for same buyer/content supported");
      console.log("Escrow 1 seed:", escrow1.seed.toString());
      console.log("Escrow 2 seed:", escrow2.seed.toString());
    });
  });

  describe("Cancel Escrow", () => {
    it("Should cancel escrow before payment", async () => {
      const seed3 = getUniqueSeed();

      const [escrowPda3] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyer.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed3.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), escrowPda3.toBuffer()],
        program.programId
      );

      // Initialize escrow
      await program.methods
        .initializeEscrow(contentId, price, null, seed3)
        .accountsPartial({
          buyer: buyer.publicKey,
          creator: creator.publicKey,
          escrowState: escrowPda3,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Escrow initialized for cancellation test");

      // Cancel the escrow
      // For SOL payments, use buyer/vault as placeholder for token accounts
      const tx = await program.methods
        .cancelEscrow()
        .accountsPartial({
          buyer: buyer.publicKey,
          escrowState: escrowPda3,
          vault: vaultPda,
          buyerTokenAccount: buyer.publicKey,  // Placeholder for SOL
          vaultTokenAccount: vaultPda,         // Placeholder for SOL
          tokenProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Escrow cancelled");
      console.log("Transaction:", tx);

      // Verify escrow account is closed
      try {
        await program.account.escrowState.fetch(escrowPda3);
        expect.fail("Escrow should be closed");
      } catch (error: any) {
        expect(error.toString()).to.include("Account does not exist");
        console.log("Escrow account closed successfully");
      }
    });
  });

  describe("Escrow Lifecycle", () => {
    it("Should track escrow state correctly", async () => {
      const seed4 = getUniqueSeed();

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyer.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed4.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Initialize
      await program.methods
        .initializeEscrow(contentId, price, null, seed4)
        .accountsPartial({
          buyer: buyer.publicKey,
          creator: creator.publicKey,
          escrowState: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Fetch state
      const escrowState = await program.account.escrowState.fetch(escrowPda);

      // Verify all fields
      expect(escrowState.buyer.toString()).to.equal(buyer.publicKey.toString());
      expect(escrowState.creator.toString()).to.equal(creator.publicKey.toString());
      expect(escrowState.price.toNumber()).to.be.greaterThan(0);
      expect(escrowState.paymentAmount.toNumber()).to.equal(0);
      expect(escrowState.accessMintAddress).to.be.null;

      console.log("Escrow lifecycle tracked");
      console.log("Buyer:", escrowState.buyer.toString());
      console.log("Creator:", escrowState.creator.toString());
      console.log("Price:", escrowState.price.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("Payment amount:", escrowState.paymentAmount.toNumber());
    });
  });
});
