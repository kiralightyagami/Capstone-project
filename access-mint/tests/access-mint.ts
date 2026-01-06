import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AccessMint } from "../target/types/access_mint";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Access Mint Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AccessMint as Program<AccessMint>;

  let creator: Keypair;
  let buyer: Keypair;
  let mint: Keypair;

  const contentId = Array.from({ length: 32 }, (_, i) => i + 1);
  const seed = new anchor.BN(1);

  before(async () => {
    creator = (provider.wallet as anchor.Wallet).payer;
    buyer = Keypair.generate();
    mint = Keypair.generate();

    // Airdrop SOL to buyer
    const airdropSig = await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    console.log("Test accounts initialized");
    console.log("Program ID:", program.programId.toString());
  });

  describe("Initialize Access Mint", () => {
    let accessMintStatePda: PublicKey;
    let mintAuthorityPda: PublicKey;

    it("Should initialize access mint for content", async () => {
      // Derive PDAs
      [accessMintStatePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [mintAuthorityPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_authority"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const tx = await program.methods
        .initializeMint(contentId, seed)
        .accountsPartial({
          creator: creator.publicKey,
          accessMintState: accessMintStatePda,
          mint: mint.publicKey,
          mintAuthority: mintAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      console.log("Access mint initialized");
      console.log("Transaction:", tx);

      // Fetch and verify access mint state
      const accessMintState = await program.account.accessMintState.fetch(accessMintStatePda);

      expect(accessMintState.creator.toString()).to.equal(creator.publicKey.toString());
      expect(accessMintState.mint.toString()).to.equal(mint.publicKey.toString());
      expect(accessMintState.mintAuthority.toString()).to.equal(mintAuthorityPda.toString());
      expect(accessMintState.totalMinted.toNumber()).to.equal(0);

      console.log("Mint:", mint.publicKey.toString());
      console.log("Mint Authority:", mintAuthorityPda.toString());
      console.log("Total Minted:", accessMintState.totalMinted.toNumber());

      // Verify mint account
      const mintInfo = await provider.connection.getAccountInfo(mint.publicKey);
      expect(mintInfo).to.not.be.null;
      console.log("SPL Mint account created");
    });
  });

  describe("Mint Access Token", () => {
    let accessMintStatePda: PublicKey;
    let mintAuthorityPda: PublicKey;
    let buyerTokenAccount: PublicKey;

    before(async () => {
      // Use seed 2 for this test suite
      const seed2 = new anchor.BN(2);
      const mint2 = Keypair.generate();

      [accessMintStatePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_state"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [mintAuthorityPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_authority"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Initialize the mint first
      await program.methods
        .initializeMint(contentId, seed2)
        .accountsPartial({
          creator: creator.publicKey,
          accessMintState: accessMintStatePda,
          mint: mint2.publicKey,
          mintAuthority: mintAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint2])
        .rpc();

      // Get buyer's token account address
      buyerTokenAccount = await getAssociatedTokenAddress(
        mint2.publicKey,
        buyer.publicKey
      );

      mint = mint2; // Store for use in tests
    });

    it("Should mint access token to buyer", async () => {
      const tx = await program.methods
        .mintAccess()
        .accountsPartial({
          buyer: buyer.publicKey,
          payer: buyer.publicKey,
          accessMintState: accessMintStatePda,
          mint: mint.publicKey,
          mintAuthority: mintAuthorityPda,
          buyerTokenAccount: buyerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("Access token minted");
      console.log("Transaction:", tx);

      // Verify token account was created and has 1 token
      const tokenAccountInfo = await getAccount(
        provider.connection,
        buyerTokenAccount
      );

      expect(tokenAccountInfo.amount).to.equal(BigInt(1));
      expect(tokenAccountInfo.mint.toString()).to.equal(mint.publicKey.toString());
      expect(tokenAccountInfo.owner.toString()).to.equal(buyer.publicKey.toString());

      console.log("Buyer received 1 access token");
      console.log("Token amount:", tokenAccountInfo.amount.toString());

      // Verify total minted counter increased
      const accessMintState = await program.account.accessMintState.fetch(accessMintStatePda);
      expect(accessMintState.totalMinted.toNumber()).to.equal(1);

      console.log("Total minted:", accessMintState.totalMinted.toNumber());
    });

    it("Should verify buyer has access", async () => {
      // Check token balance
      const tokenAccountInfo = await getAccount(
        provider.connection,
        buyerTokenAccount
      );

      const hasAccess = tokenAccountInfo.amount >= BigInt(1);
      expect(hasAccess).to.be.true;

      console.log("Access verification successful");
      console.log("Buyer has", tokenAccountInfo.amount.toString(), "access token(s)");
    });
  });

  describe("Access Token Properties", () => {
    it("Should verify mint has 0 decimals", async () => {
      const mintInfo = await provider.connection.getAccountInfo(mint.publicKey);
      expect(mintInfo).to.not.be.null;

      // Parse mint data to check decimals
      // SPL Token Mint layout: decimals at byte 44
      const decimals = mintInfo!.data[44];
      expect(decimals).to.equal(0);

      console.log("Mint has 0 decimals (non-divisible)");
    });

    it("Should verify mint authority is PDA", async () => {
      const [expectedAuthority] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("access_mint_authority"),
          creator.publicKey.toBuffer(),
          Buffer.from(contentId),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Verify mint authority matches PDA
      const accessMintState = await program.account.accessMintState.fetch(
        PublicKey.findProgramAddressSync(
          [
            Buffer.from("access_mint_state"),
            creator.publicKey.toBuffer(),
            Buffer.from(contentId),
            seed.toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        )[0]
      );

      expect(accessMintState.mintAuthority.toString()).to.equal(expectedAuthority.toString());

      console.log("Mint authority is PDA (only program can mint)");
      console.log("Authority:", expectedAuthority.toString());
    });
  });
});