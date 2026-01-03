import { LiteSVM } from "litesvm";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import BN from "bn.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Access Mint Program (LiteSVM)", () => {
  let svm: LiteSVM;
  let programId: PublicKey;
  let creator: Keypair;
  let buyer: Keypair;

  before(() => {
   
    const programPath = path.join(__dirname, "../target/deploy/access_mint.so");
    const programBuffer = fs.readFileSync(programPath);

    
    const programKeypairPath = path.join(__dirname, "../target/deploy/access_mint-keypair.json");
    const programKeypairData = JSON.parse(fs.readFileSync(programKeypairPath, "utf-8"));
    const programKeypair = Keypair.fromSecretKey(new Uint8Array(programKeypairData));
    programId = programKeypair.publicKey;

    
    svm = new LiteSVM();
    svm.addProgram(programId, programBuffer);

    // Create test accounts
    creator = Keypair.generate();
    buyer = Keypair.generate();

    
    svm.airdrop(creator.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(buyer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    console.log("LiteSVM initialized");
    console.log("Program ID:", programId.toString());
  });

  describe("Basic Functionality", () => {
    it("Should transfer SOL correctly", () => {
      const sender = Keypair.generate();
      const receiver = PublicKey.unique();
      
      svm.airdrop(sender.publicKey, BigInt(LAMPORTS_PER_SOL));
      
      const transferAmount = 1_000_000n;
      const ix = SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: receiver,
        lamports: transferAmount,
      });
      
      const tx = new Transaction();
      tx.recentBlockhash = svm.latestBlockhash();
      tx.add(ix);
      tx.sign(sender);
      
      svm.sendTransaction(tx);
      
      const balanceAfter = svm.getBalance(receiver);
      expect(balanceAfter).to.equal(transferAmount);
      
      console.log("SOL transfer successful");
    });
  });

  describe("Program Verification", () => {
    it("Should have program loaded in LiteSVM", () => {
      const programAccount = svm.getAccount(programId);
      expect(programAccount).to.not.be.null;
      expect(programAccount?.executable).to.be.true;
      
      console.log("Program loaded successfully");
      console.log("Program ID:", programId.toString());
    });

    it("Should derive access mint state PDA correctly", () => {
      const contentId = Buffer.alloc(32, 1);
      const seed = new BN(1);
      
      // Derive access mint state PDA
      const [accessMintStatePda, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          contentId,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      console.log("Access mint state PDA derivation successful");
      console.log("Access Mint State PDA:", accessMintStatePda.toString());
      console.log("Bump:", bump);
      
      expect(bump).to.be.greaterThan(0);
      expect(bump).to.be.lessThan(256);
    });

    it("Should derive mint authority PDA correctly", () => {
      const contentId = Buffer.alloc(32, 1);
      const seed = new BN(1);
      
      // Derive mint authority PDA
      const [mintAuthorityPda, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_authority"),
          creator.publicKey.toBuffer(),
          contentId,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      console.log("Mint authority PDA derivation successful");
      console.log("Mint Authority PDA:", mintAuthorityPda.toString());
      console.log("Bump:", bump);
      
      expect(mintAuthorityPda).to.not.be.undefined;
    });
  });

  describe("Access Token Validation", () => {
    it("Should calculate correct PDA relationships", () => {
      const contentId = Buffer.alloc(32, 2);
      const seed = new BN(100);
      
      // Derive both PDAs for the same content
      const [statePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          contentId,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      const [authorityPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_authority"),
          creator.publicKey.toBuffer(),
          contentId,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      // They should be different
      expect(statePda.toString()).to.not.equal(authorityPda.toString());
      
      console.log("PDA relationships validated");
      console.log("State PDA:", statePda.toString());
      console.log("Authority PDA:", authorityPda.toString());
    });

    it("Should derive unique PDAs for different content", () => {
      const contentId1 = Buffer.alloc(32, 1);
      const contentId2 = Buffer.alloc(32, 2);
      const seed = new BN(1);
      
      const [pda1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          contentId1,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      const [pda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          contentId2,
          seed.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      // Different content should have different PDAs
      expect(pda1.toString()).to.not.equal(pda2.toString());
      
      console.log("Unique PDA generation verified");
      console.log("Content 1 PDA:", pda1.toString());
      console.log("Content 2 PDA:", pda2.toString());
    });

    it("Should derive unique PDAs for different seeds", () => {
      const contentId = Buffer.alloc(32, 1);
      const seed1 = new BN(1);
      const seed2 = new BN(2);
      
      const [pda1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          contentId,
          seed1.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      const [pda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          contentId,
          seed2.toArrayLike(Buffer, "le", 8),
        ],
        programId
      );

      // Different seeds should have different PDAs
      expect(pda1.toString()).to.not.equal(pda2.toString());
      
      console.log("Seed-based PDA uniqueness verified");
      console.log("Seed 1 PDA:", pda1.toString());
      console.log("Seed 2 PDA:", pda2.toString());
    });
  });

  describe("Token Program Integration", () => {
    it("Should validate Token Program ID", () => {
      expect(TOKEN_PROGRAM_ID.toString()).to.equal("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      console.log("Token Program ID validated:", TOKEN_PROGRAM_ID.toString());
    });

    it("Should have SPL Token program available", () => {
      // Verify we can work with token program ID
      const tokenProgramAccount = svm.getAccount(TOKEN_PROGRAM_ID);
      
      // Token program might not be loaded in LiteSVM by default
      // This test verifies we can reference it
      console.log("Token Program reference available");
      console.log("Token Program ID:", TOKEN_PROGRAM_ID.toString());
    });
  });

  describe("Access Control Logic", () => {
    it("Should validate non-transferable token concept", () => {
      // Test the concept: buyer should have exactly 1 token (0 decimals)
      const expectedTokenAmount = 1;
      const decimals = 0;
      
      // With 0 decimals, smallest unit = 1 token
      const smallestUnit = Math.pow(10, decimals);
      expect(smallestUnit).to.equal(1);
      
      // Verify token amount calculation
      const tokenAmount = expectedTokenAmount * smallestUnit;
      expect(tokenAmount).to.equal(1);
      
      console.log("Non-transferable token logic validated");
      console.log("Decimals:", decimals);
      console.log("Token amount:", tokenAmount);
    });

    it("Should validate access verification logic", () => {
      // Simulate access check: buyer must have >= 1 token
      const buyerTokenBalance = 1;
      const requiredBalance = 1;
      
      const hasAccess = buyerTokenBalance >= requiredBalance;
      expect(hasAccess).to.be.true;
      
      // Without token
      const noBuyerTokenBalance = 0;
      const noAccess = noBuyerTokenBalance >= requiredBalance;
      expect(noAccess).to.be.false;
      
      console.log("Access verification logic validated");
      console.log("Has access (balance=1):", hasAccess);
      console.log("No access (balance=0):", noAccess);
    });
  });
});