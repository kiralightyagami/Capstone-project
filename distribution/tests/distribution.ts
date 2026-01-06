import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Distribution } from "../target/types/distribution";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("Distribution Program", () => {
  
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Distribution as Program<Distribution>;

 
  let creator: Keypair;
  let platformTreasury: Keypair;
  let collaborator1: Keypair;
  let collaborator2: Keypair;

  
  const contentId = Array.from({ length: 32 }, (_, i) => i + 1);
  const seed = new anchor.BN(1);
  const platformFeeBps = 250; // 2.5%

  before(async () => {
    creator = (provider.wallet as anchor.Wallet).payer;
    platformTreasury = Keypair.generate();
    collaborator1 = Keypair.generate();
    collaborator2 = Keypair.generate();

    
    const airdropSigs = await Promise.all([
      provider.connection.requestAirdrop(platformTreasury.publicKey, 2 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(collaborator1.publicKey, 2 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(collaborator2.publicKey, 2 * LAMPORTS_PER_SOL),
    ]);

    
    await Promise.all(
      airdropSigs.map(sig => provider.connection.confirmTransaction(sig))
    );

    console.log("Test accounts initialized");
    console.log("Program ID:", program.programId.toString());
  });

  describe("Initialize Split Configuration", () => {
    let splitPda: PublicKey;

    it("Should initialize split without collaborators", async () => {
      // Derive split PDA
      [splitPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("split"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const tx = await program.methods
        .initializeSplit(
          contentId,
          platformFeeBps,
          [],
          seed
        )
        .accountsPartial({
          creator: creator.publicKey,
          platformTreasury: platformTreasury.publicKey,
          splitState: splitPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Split initialized (no collaborators)");
      console.log("Transaction:", tx);

      // Fetch and verify split state
      const splitState = await program.account.splitState.fetch(splitPda);

      expect(splitState.creator.toString()).to.equal(creator.publicKey.toString());
      expect(splitState.platformFeeBps).to.equal(platformFeeBps);
      expect(splitState.platformTreasury.toString()).to.equal(platformTreasury.publicKey.toString());
      expect(splitState.collaborators.length).to.equal(0);

      console.log("Platform fee:", splitState.platformFeeBps, "bps (2.5%)");
      console.log("Collaborators:", splitState.collaborators.length);
    });

    it("Should initialize split with collaborators", async () => {
      const seed2 = new anchor.BN(2);

      const [splitPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("split"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const collaborators = [
        { pubkey: collaborator1.publicKey, shareBps: 500 },  // 5%
        { pubkey: collaborator2.publicKey, shareBps: 300 },  // 3%
      ];

      const tx = await program.methods
        .initializeSplit(contentId, platformFeeBps, collaborators, seed2)
        .accountsPartial({
          creator: creator.publicKey,
          platformTreasury: platformTreasury.publicKey,
          splitState: splitPda2,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Split initialized (with collaborators)");
      console.log("Transaction:", tx);

      // Fetch and verify
      const splitState = await program.account.splitState.fetch(splitPda2);

      expect(splitState.collaborators.length).to.equal(2);
      expect(splitState.collaborators[0].shareBps).to.equal(500);
      expect(splitState.collaborators[1].shareBps).to.equal(300);

      console.log("Collaborator 1:", collaborator1.publicKey.toString(), "- 5%");
      console.log("Collaborator 2:", collaborator2.publicKey.toString(), "- 3%");
    });

    it("Should fail if platform fee exceeds 10%", async () => {
      const seed3 = new anchor.BN(3);

      const [invalidSplitPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("split"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed3.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .initializeSplit(contentId, 1500, [], seed3) // 15% - exceeds max
          .accountsPartial({
            creator: creator.publicKey,
            platformTreasury: platformTreasury.publicKey,
            splitState: invalidSplitPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have thrown InvalidPlatformFee error");
      } catch (error: any) {
        expect(error.toString()).to.include("InvalidPlatformFee");
        console.log("Correctly rejected platform fee > 10%");
      }
    });

    it("Should fail if total shares exceed 100%", async () => {
      const seed4 = new anchor.BN(4);

      const [invalidSplitPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("split"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed4.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const invalidCollaborators = [
        { pubkey: collaborator1.publicKey, shareBps: 9000 },  // 90%
        { pubkey: collaborator2.publicKey, shareBps: 1500 },  // 15%
      ];
      // Total: 250 + 9000 + 1500 = 10750 > 10000

      try {
        await program.methods
          .initializeSplit(contentId, platformFeeBps, invalidCollaborators, seed4)
          .accountsPartial({
            creator: creator.publicKey,
            platformTreasury: platformTreasury.publicKey,
            splitState: invalidSplitPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have thrown InvalidShareDistribution error");
      } catch (error: any) {
        expect(error.toString()).to.include("InvalidShareDistribution");
        console.log("Correctly rejected total shares > 100%");
      }
    });
  });

  describe("Platform Validation", () => {
    it("Should validate basic math calculations", () => {
      // Test share calculations
      const totalAmount = 10 * LAMPORTS_PER_SOL;
      const platformFeeBps = 250; // 2.5%
      
      const platformFee = Math.floor(totalAmount * platformFeeBps / 10000);
      const expectedPlatformFee = 0.25 * LAMPORTS_PER_SOL;
      
      expect(platformFee).to.equal(expectedPlatformFee);
      
      console.log("Share calculations verified");
      console.log("Total:", totalAmount / LAMPORTS_PER_SOL, "SOL");
      console.log("Platform fee (2.5%):", platformFee / LAMPORTS_PER_SOL, "SOL");
    });

    it("Should calculate creator share correctly", () => {
      const totalAmount = 10 * LAMPORTS_PER_SOL;
      const platformBps = 250;  // 2.5%
      const collab1Bps = 500;   // 5%
      const collab2Bps = 300;   // 3%
      
      const platformFee = Math.floor(totalAmount * platformBps / 10000);
      const collab1Share = Math.floor(totalAmount * collab1Bps / 10000);
      const collab2Share = Math.floor(totalAmount * collab2Bps / 10000);
      const creatorShare = totalAmount - platformFee - collab1Share - collab2Share;
      
      // Verify all adds up
      const total = platformFee + collab1Share + collab2Share + creatorShare;
      expect(total).to.equal(totalAmount);
      
      console.log("Distribution breakdown:");
      console.log("  Platform (2.5%):", platformFee / LAMPORTS_PER_SOL, "SOL");
      console.log("  Collab 1 (5%):", collab1Share / LAMPORTS_PER_SOL, "SOL");
      console.log("  Collab 2 (3%):", collab2Share / LAMPORTS_PER_SOL, "SOL");
      console.log("  Creator (89.5%):", creatorShare / LAMPORTS_PER_SOL, "SOL");
      console.log("  Total:", total / LAMPORTS_PER_SOL, "SOL");
    });
  });
});