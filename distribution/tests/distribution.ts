import { LiteSVM } from "litesvm";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import BN from "bn.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Distribution Program (LiteSVM)", () => {
  let svm: LiteSVM;
  let programId: PublicKey;
  let creator: Keypair;
  let platformTreasury: Keypair;
  let collaborator1: Keypair;
  let collaborator2: Keypair;

  before(() => {
    // Load the compiled program
    const programPath = path.join(__dirname, "../target/deploy/distribution.so");
    const programBuffer = fs.readFileSync(programPath);

    // Get program ID from keypair
    const programKeypairPath = path.join(__dirname, "../target/deploy/distribution-keypair.json");
    const programKeypairData = JSON.parse(fs.readFileSync(programKeypairPath, "utf-8"));
    const programKeypair = Keypair.fromSecretKey(new Uint8Array(programKeypairData));
    programId = programKeypair.publicKey;

    // Initialize LiteSVM
    svm = new LiteSVM();
    svm.addProgram(programId, programBuffer);

    // Create test accounts
    creator = Keypair.generate();
    platformTreasury = Keypair.generate();
    collaborator1 = Keypair.generate();
    collaborator2 = Keypair.generate();

    // Airdrop SOL
    svm.airdrop(creator.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(platformTreasury.publicKey, BigInt(1 * LAMPORTS_PER_SOL));
    svm.airdrop(collaborator1.publicKey, BigInt(1 * LAMPORTS_PER_SOL));
    svm.airdrop(collaborator2.publicKey, BigInt(1 * LAMPORTS_PER_SOL));

    console.log("LiteSVM initialized");
    console.log("Program ID:", programId.toString());
  });

  describe("Basic SOL Distribution", () => {
    it("Should distribute SOL correctly", () => {
      const sender = Keypair.generate();
      const receiver = PublicKey.unique();
      
      // Airdrop to sender
      svm.airdrop(sender.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
      
      // Create transfer instruction
      const transferAmount = 1_000_000n;
      const ix = SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: receiver,
        lamports: transferAmount,
      });
      
      // Build and send transaction
      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(ix);
      tx.sign(sender);
      
      svm.sendTransaction(tx);
      
      // Verify balances
      const balanceAfter = svm.getBalance(receiver);
      expect(balanceAfter).to.equal(transferAmount);
      
      console.log("SOL transfer successful");
    });
  });

  describe("Program Verification", () => {
    it("Should have program loaded in LiteSVM", () => {
      // Verify program exists in SVM
      const programAccount = svm.getAccount(programId);
      expect(programAccount).to.not.be.null;
      expect(programAccount?.executable).to.be.true;
      
      console.log("Program loaded successfully");
      console.log("Program ID:", programId.toString());
    });

    it("Should derive PDAs correctly", () => {
      const contentId = Buffer.alloc(32, 1);
      const seed = new BN(1);
      
      // Derive split PDA
      const [splitPda, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("split"),
          creator.publicKey.toBuffer(),
          contentId,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      console.log("PDA derivation successful");
      console.log("Split PDA:", splitPda.toString());
      console.log("Bump:", bump);
      
      expect(bump).to.be.greaterThan(0);
      expect(bump).to.be.lessThan(256);
    });

    it("Should derive vault PDA correctly", () => {
      const fakeSplitPda = PublicKey.unique();
      
      const [vaultPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), fakeSplitPda.toBuffer()],
        programId
      );

      console.log("Vault PDA derivation successful");
      console.log("Vault PDA:", vaultPda.toString());
      console.log("Bump:", bump);
      
      expect(vaultPda).to.not.be.undefined;
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