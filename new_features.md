I need to migrate my existing project from Arc/EVM blockchain to Solana.

IMPORTANT:
This is a BLOCKCHAIN MIGRATION, not an additional blockchain integration.

The final application should use SOLANA ONLY.

Remove the existing Arc blockchain implementation and all EVM/VM-specific functionality that is only required for Arc/EVM.

Do NOT keep Arc as a selectable blockchain/network.

Do NOT build a multi-chain architecture unless something is explicitly required by the existing application.

============================================================
1. CURRENT → NEW ARCHITECTURE
============================================================

CURRENT:

Application
   ↓
Arc Testnet
   ↓
EVM / VM
   ↓
USDC
   ↓
Wallet connection

NEW:

Application
   ↓
Solana Devnet
   ↓
Solana
   ↓
USDC SPL Token
   ↓
Solana Wallet Adapter
   ↓
Phantom / Solflare / other supported Solana wallets

The final application should no longer depend on Arc/EVM for the Points purchase/withdrawal functionality.

============================================================
2. SOLANA NETWORK
============================================================

Use:

Network:
Solana Devnet

RPC:
Use Solana Devnet RPC configuration.

The RPC must be configurable through environment variables.

Example:

SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

Do NOT hard-code the RPC URL throughout the project.

If the project already has an RPC abstraction/configuration system, reuse it.

============================================================
3. SOLANA USDC
============================================================

Use the following Solana Devnet USDC mint:

4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

Store it in configuration/environment variables.

Example:

SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

Do NOT duplicate this address throughout the codebase.

Create one centralized blockchain configuration.

IMPORTANT:

This is an SPL token mint on Solana.

Do NOT treat the Solana USDC mint like an EVM ERC-20 contract.

Remove EVM-specific concepts such as:

- ERC-20
- approve()
- transfer()
- transferFrom()
- contract address
- EVM chain ID
- Ethereum transaction receipt
- EVM logs
- EVM event decoding
- ethers
- viem EVM providers
- wagmi
- EVM wallet providers

Replace them with the appropriate Solana/SPL-token implementation.

============================================================
4. WALLET CONNECTION
============================================================

Use Solana Wallet Adapter.

Reference:

https://github.com/anza-xyz/wallet-adapter

Official Solana React wallet connection documentation:

https://solana.com/developers/cookbook/wallets/connect-wallet-react

Use the appropriate packages for the existing frontend architecture.

Expected architecture:

ConnectionProvider
    ↓
WalletProvider
    ↓
WalletModalProvider
    ↓
Application

The official Solana example uses:

@solana/web3.js
@solana/wallet-adapter-base
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui

Use the current recommended approach compatible with the project's React/Next.js/Vite setup.

Do NOT introduce Reown for Solana wallet connection unless the project specifically requires Reown.

The requested wallet connection implementation is:

SOLANA WALLET ADAPTER

============================================================
5. USER FRONTEND WALLET
============================================================

Add Solana wallet connection to the User Frontend.

The user should see:

[ Connect Wallet ]

After connection:

Connected Wallet
7xKX...9AbC

[ Disconnect ]

Support standard Solana wallets available through the wallet adapter.

The wallet address should be a Solana public key/base58 address.

Do NOT assume EVM addresses.

Do NOT display:

0x1234...

Use Solana addresses such as:

7xKX...9AbC

============================================================
6. ADMIN FRONTEND WALLET
============================================================

Add Solana wallet connection to the Admin Frontend as well.

Admin should be able to:

- Connect Solana wallet
- See connected Solana address
- Disconnect wallet
- Reconnect wallet
- Verify network
- Use the wallet for supported admin blockchain operations

The admin frontend must use the same Solana wallet architecture.

Do NOT create separate wallet connection implementations for User and Admin.

Create a reusable Solana wallet provider/component/service where possible.

============================================================
7. REMOVE ARC BLOCKCHAIN
============================================================

Search the entire repository for Arc/EVM-specific implementation.

Find and remove/rework:

- Arc Testnet configuration
- Arc RPC
- Arc chain ID 5042002
- EVM providers
- ethers
- viem EVM usage
- wagmi
- EVM wallet adapters
- Reown EVM configuration
- EVM contract ABI
- EVM contract services
- ERC-20 services
- EVM transaction verification
- EVM receipt handling
- EVM event parsing
- EVM address validation
- EVM chain switching
- EVM-specific environment variables
- EVM blockchain utilities
- Arc-specific backend services
- Arc-specific frontend components

Search for:

arc
ARC
5042002
https://arc-testnet.drpc.org
ethers
viem
wagmi
WalletConnect
Reown
EVM
Ethereum
ERC20
ERC-20
contract
chainId
transactionReceipt
logs
0x

Inspect every result before deleting it.

IMPORTANT:

Do NOT blindly delete files.

Some generic files may contain reusable business logic.

Only remove/rewrite blockchain-specific functionality.

============================================================
8. REMOVE VM FUNCTIONALITY
============================================================

The existing project has VM/EVM functionality.

Remove VM-specific functionality that was created for the Arc blockchain.

This includes any:

- VM provider
- EVM execution layer
- EVM transaction service
- EVM contract abstraction
- EVM ABI handling
- EVM gas estimation
- EVM gas configuration
- EVM chain configuration
- EVM transaction receipt handling

Replace the required functionality with Solana equivalents.

Do NOT leave dead VM code in the project.

============================================================
9. POINT PURCHASE
============================================================

The existing application allows users to purchase Points using stablecoins.

Previously:

User
 ↓
Arc wallet
 ↓
Arc USDC
 ↓
EVM transaction
 ↓
Backend verification
 ↓
Points credited

Change it to:

User
 ↓
Solana wallet
 ↓
Solana Devnet USDC
 ↓
SPL token transfer
 ↓
Backend verification
 ↓
Points credited

The business logic for Points must remain unchanged.

Only the blockchain/payment implementation should change.

============================================================
10. POINT PURCHASE FLOW
============================================================

User:

1. Connect Solana wallet.
2. Click "Buy Points".
3. Enter USDC amount.
4. System calculates Points.
5. User confirms purchase.
6. Solana wallet opens.
7. User signs the transaction.
8. USDC SPL token transfer is submitted.
9. Frontend receives Solana transaction signature.
10. Frontend sends transaction signature + purchase ID to backend.
11. Backend verifies the Solana transaction.
12. Backend verifies:
    - Solana network
    - USDC mint
    - sender wallet
    - recipient wallet
    - token amount
    - transaction success
13. Backend credits Points.
14. CoinTransaction is created.
15. Purchase is marked CONFIRMED.

IMPORTANT:

Never credit Points merely because the frontend says:

"transaction successful"

The backend must independently verify the transaction on Solana.

============================================================
11. SOLANA SPL TOKEN TRANSFER
============================================================

USDC on Solana is an SPL token.

Do NOT use:

approve()
transferFrom()

or ERC-20 contracts.

Use the appropriate Solana/SPL token instructions and libraries.

Inspect the existing project dependencies and use compatible Solana packages.

The implementation should correctly handle:

- Token mint
- Associated Token Accounts
- Token decimals
- Token transfer
- Transaction signature
- Confirmation
- Transaction status

============================================================
12. ASSOCIATED TOKEN ACCOUNTS
============================================================

Correctly handle Associated Token Accounts (ATA).

The sender and receiver may have different token accounts for the USDC mint.

Do not assume:

wallet address == USDC token account

Resolve the appropriate Associated Token Account for:

- User wallet
- Platform receiving wallet

Use the configured USDC mint.

If the recipient ATA does not exist, implement the appropriate creation flow where required.

============================================================
13. USDC DECIMALS
============================================================

Do NOT use JavaScript floating-point arithmetic for token amounts.

Use integer/base-unit calculations.

For example:

10 USDC

must be converted into the correct SPL token base units based on the configured USDC mint decimals.

Use appropriate Solana/SPL token utilities.

The backend should verify the raw token amount from the blockchain.

============================================================
14. BACKEND VERIFICATION
============================================================

Replace the existing EVM transaction verification service with a Solana transaction verification service.

For example:

Old:

EvmTransactionService

New:

SolanaTransactionService

or an equivalent naming convention matching the existing project.

The backend should verify:

- Transaction signature exists
- Transaction is on Solana Devnet
- Transaction succeeded
- Correct USDC mint
- Correct sender
- Correct recipient
- Correct token amount
- Correct purchase ID association where applicable
- Transaction has not already been processed

Do not trust frontend-provided:

- amount
- points
- sender
- receiver
- token
- status

The backend must derive/verify these values from Solana transaction data.

============================================================
15. DUPLICATE TRANSACTION PROTECTION
============================================================

A Solana transaction signature must never be processed twice.

Add a unique constraint/index where appropriate.

Example:

transactionSignature UNIQUE

If the same signature is submitted again:

Return:

"Transaction has already been processed."

Do NOT credit Points twice.

============================================================
16. POINT PURCHASE DATABASE
============================================================

Inspect the existing PointPurchase model.

Do not create a duplicate purchase model if one already exists.

Update the existing model as required.

The blockchain-related fields should support Solana.

For example:

id
userId
walletAddress
tokenMint
amountUsdc
points
exchangeRate
network
transactionSignature
status
createdAt
updatedAt
completedAt

Replace old EVM-specific fields such as:

transactionHash

with something like:

transactionSignature

if appropriate.

Do not maintain EVM terminology after migration.

============================================================
17. WITHDRAWAL FUNCTIONALITY
============================================================

The existing project also contains Points withdrawal functionality.

Migrate withdrawal from Arc/EVM to Solana.

Previous:

Points
 ↓
Admin approval
 ↓
Arc USDT/USDC transfer
 ↓
EVM transaction

New:

Points
 ↓
Admin approval
 ↓
Solana SPL USDC transfer
 ↓
Solana transaction
 ↓
Confirmation
 ↓
Completed

Preserve the existing withdrawal business rules.

Do NOT change:

- minimum withdrawal
- withdrawable points rules
- admin approval/rejection flow
- point reservation
- withdrawal history

unless required for the Solana migration.

Only change the blockchain implementation.

============================================================
18. WITHDRAWAL TOKEN
============================================================

Inspect the existing project requirement carefully.

The application currently has stablecoin purchase/withdrawal functionality.

Determine whether withdrawal is:

USDT
or
USDC

Do NOT silently change the business requirement.

If the new requirement is to use Solana USDC for both:

POINT PURCHASE
and
WITHDRAWAL

then use the configured Solana Devnet USDC mint:

4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

If withdrawal must remain USDT, identify the required Solana Devnet USDT mint as a separate configuration.

Do NOT assume USDT = USDC.

============================================================
19. ADMIN WITHDRAWAL
============================================================

Admin approval remains mandatory.

Flow:

User requests withdrawal
        ↓
PENDING
        ↓
Admin reviews
        ↓
APPROVED
        ↓
PROCESSING
        ↓
Solana SPL USDC transfer
        ↓
Solana confirmation
        ↓
COMPLETED

If transfer fails:

FAILED

The user's reserved points must not be lost.

============================================================
20. ADMIN SOLANA WALLET
============================================================

The Admin frontend should have a Solana wallet connection.

Display:

Admin Wallet

7xKX...9AbC

Network:

Solana Devnet

The connected admin wallet may be used to sign authorized blockchain transactions if the existing business flow requires admin wallet signing.

Do NOT expose private keys to the frontend or backend.

The admin should sign blockchain transactions using their wallet.

============================================================
21. BACKEND TREASURY WALLET
============================================================

Inspect the existing architecture.

If the previous Arc implementation used a server-side treasury wallet/private key, do not blindly carry that architecture into Solana.

Prefer secure wallet signing architecture.

If server-side signing is genuinely required:

- Store the Solana private key securely.
- Never commit it.
- Never expose it to the frontend.
- Never return it through APIs.
- Add it only through environment/secret management.

Example:

SOLANA_TREASURY_PRIVATE_KEY=

or another secure format compatible with the project's wallet implementation.

IMPORTANT:

Do not generate or invent a private key.

============================================================
22. USER WALLET ADDRESS STORAGE
============================================================

Inspect the existing User model.

If it currently stores an EVM wallet address, migrate/rework it for Solana.

For example:

walletAddress

should now contain a Solana base58 public key.

Validate using Solana public-key validation.

Do NOT use EVM address validation such as:

/^0x[a-fA-F0-9]{40}$/

Use the appropriate Solana PublicKey validation.

============================================================
23. WALLET AUTHENTICATION
============================================================

If the application currently supports wallet-based authentication/signatures:

Migrate the authentication message/signature verification from EVM to Solana.

Do NOT use:

EIP-191
EIP-712
eth_sign
personal_sign

for Solana wallet authentication.

Use Solana-compatible message signing and signature verification.

Only change authentication if the existing application actually uses wallet authentication.

============================================================
24. FRONTEND PROVIDER
============================================================

Create a reusable Solana provider.

For React/Next.js/Vite, use the appropriate architecture.

Conceptually:

ConnectionProvider
    ↓
WalletProvider
    ↓
WalletModalProvider
    ↓
Application

Use Devnet.

The Solana documentation currently demonstrates this pattern with:

@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/web3.js

Reference:

https://solana.com/developers/cookbook/wallets/connect-wallet-react

============================================================
25. USER + ADMIN SHARED WALLET COMPONENT
============================================================

Create reusable components where possible:

SolanaWalletProvider
SolanaConnectButton
SolanaWalletButton
useSolanaWallet
solanaConfig

Do not duplicate wallet connection code between:

user_frontend
admin_frontend

unless the existing architecture requires separate packages.

============================================================
26. REMOVE REOWN EVM
============================================================

The previous implementation may have used Reown for EVM wallet connection.

Remove the EVM Reown configuration if it is no longer required.

Do NOT leave:

- EVM Reown project configuration
- EVM WalletConnect configuration
- EVM chain definitions
- Ethereum connectors

Use Solana Wallet Adapter as requested.

IMPORTANT:

If any Reown package is still required by another unrelated feature, do not remove it blindly.

Inspect usage first.

============================================================
27. ENVIRONMENT VARIABLES
============================================================

Create/update .env.example.

Example:

SOLANA_NETWORK=devnet

SOLANA_RPC_URL=https://api.devnet.solana.com

SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

SOLANA_TREASURY_ADDRESS=

SOLANA_USDC_DECIMALS=

SOLANA_EXPLORER_URL=https://explorer.solana.com

Do not commit real private keys.

If wallet-adapter frontend configuration requires additional environment variables, add them appropriately.

============================================================
28. BLOCKCHAIN CONFIGURATION
============================================================

Create a centralized Solana configuration.

For example:

config/solana.ts

or follow the existing project's architecture.

It should contain:

network
rpcUrl
usdcMint
treasuryAddress
explorer configuration

Do not scatter these values throughout the project.

============================================================
29. TRANSACTION EXPLORER
============================================================

Replace Arc/EVM explorer links.

Old:

EVM/Arc transaction URL

New:

Solana Explorer transaction URL.

For Devnet transactions, make sure the generated explorer link includes the correct Devnet cluster.

Example concept:

https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet

Do not hard-code this in multiple components.

============================================================
30. ADMIN PANEL BLOCKCHAIN DATA
============================================================

Update Admin UI to show Solana information.

For purchases:

Wallet:
7xKX...9AbC

Token:
USDC

Network:
Solana Devnet

Mint:
4zMMC9...

Transaction:
5abc...

For withdrawals:

Destination wallet
USDC amount
Solana transaction signature
Status
Network

Remove:

Arc
EVM
Chain ID 5042002
0x addresses

============================================================
31. POINTS PURCHASE UI
============================================================

Existing:

Buy Points
 ↓
Connect Arc wallet

Change to:

Buy Points
 ↓
Connect Solana Wallet
 ↓
Enter USDC
 ↓
Calculate Points
 ↓
Confirm
 ↓
Solana wallet opens
 ↓
Sign transaction
 ↓
Confirm transaction
 ↓
Backend verification
 ↓
Points credited

Do not change the existing Points economy/rate unless explicitly required.

============================================================
32. WITHDRAWAL UI
============================================================

Existing withdrawal UI should now display:

Withdrawal Wallet

7xKX...9AbC

Network:

Solana Devnet

Token:

USDC

The user should connect their Solana wallet before submitting a withdrawal if that is how the existing withdrawal flow is designed.

Do not display EVM wallet information.

============================================================
33. DATABASE MIGRATION
============================================================

Inspect Prisma schema and existing migrations.

Update only the required blockchain-related fields.

Potential changes:

- walletAddress semantics
- token address → token mint
- transactionHash → transactionSignature
- chainId → Solana network
- blockchain enum/configuration
- PointPurchase
- WithdrawalRequest

Do NOT unnecessarily recreate existing business tables.

Create a proper Prisma migration.

============================================================
34. REMOVE OLD ENVIRONMENT VARIABLES
============================================================

Search for and remove obsolete variables such as:

ARC_TESTNET_CHAIN_ID
ARC_TESTNET_RPC_URL
ARC_TESTNET_USDC_ADDRESS
ARC_RPC_URL
EVM_RPC_URL
ETH_RPC_URL
REOWN_EVM_PROJECT_ID

Remove them only if they are exclusively used by the old Arc/EVM implementation.

Replace with:

SOLANA_NETWORK
SOLANA_RPC_URL
SOLANA_USDC_MINT
SOLANA_TREASURY_ADDRESS

============================================================
35. PACKAGE DEPENDENCIES
============================================================

Inspect package.json files.

Remove EVM-only dependencies if they are no longer used.

Examples to investigate:

ethers
viem
wagmi
EVM wallet packages
EVM Reown packages

Add the appropriate Solana packages.

At minimum, evaluate:

@solana/web3.js
@solana/wallet-adapter-base
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui

Use versions compatible with the existing project.

Do NOT install deprecated or unnecessary packages.

The current Solana documentation specifically demonstrates the wallet-adapter React packages and notes that Wallet Standard discovery can use wallets={[]} without the legacy wallet bundle. Follow the current recommended approach. 

============================================================
36. IMPORTANT — DO NOT BREAK BUSINESS LOGIC
============================================================

Do NOT change unrelated functionality:

- User authentication
- Predictions
- Quiz
- Points rewards
- Achievements
- Leaderboard
- Admin management
- Notifications
- Profile
- CMS
- Withdrawal approval rules
- Points purchase pricing

Only migrate the blockchain layer.

============================================================
37. SEARCH THE ENTIRE REPOSITORY
============================================================

Before implementation, search the entire project for:

Arc
arc
5042002
drpc.org
ethers
viem
wagmi
Reown
WalletConnect
EVM
Ethereum
ERC20
ERC-20
chainId
0x
approve
transferFrom
transactionHash
receipt
logs

Then categorize each result:

1. Must remove
2. Must migrate to Solana
3. Generic/reusable
4. Unrelated

Do not blindly delete code.

============================================================
38. SOLANA TRANSACTION VERIFICATION
============================================================

Implement a dedicated backend verification service.

Example:

SolanaTransactionService

Responsibilities:

- Get transaction by signature
- Verify Devnet
- Verify transaction success
- Verify USDC mint
- Verify sender
- Verify receiver
- Verify token amount
- Verify token transfer
- Prevent duplicate processing

The verification must be performed server-side.

============================================================
39. SECURITY
============================================================

Never trust frontend values.

Frontend may send:

transactionSignature
purchaseId

Backend independently verifies:

sender
receiver
mint
amount
network
transaction status

Never allow the frontend to submit:

"points": 1000000

and receive those Points without verified USDC payment.

Never allow users to provide arbitrary token mint addresses.

The backend must use the configured USDC mint.

============================================================
40. TESTING
============================================================

Test:

Wallet:

- Connect Phantom
- Connect Solflare
- Disconnect
- Reconnect
- Wrong network
- Devnet connection

Purchase:

- Connect wallet
- Buy USDC
- Submit transaction
- Verify transaction
- Credit Points
- Duplicate transaction rejected
- Wrong mint rejected
- Wrong receiver rejected
- Wrong amount rejected
- Failed transaction rejected

Withdrawal:

- Create withdrawal
- Admin sees withdrawal
- Admin approves
- Solana USDC transfer
- Transaction confirmed
- Status COMPLETED
- Transaction signature stored

Security:

- Cannot fake transaction
- Cannot reuse transaction
- Cannot fake USDC amount
- Cannot use wrong token
- Cannot use wrong network
- Cannot withdraw another user's points

============================================================
41. BUILD / TYPE CHECK
============================================================

After implementation run:

npm install

Then appropriate:

npm run lint
npm run typecheck
npm run build

And backend tests.

Run Prisma:

npx prisma generate

npx prisma migrate dev

Use the project's existing scripts where applicable.

Fix all TypeScript/build errors.

Do not leave unused EVM imports.

Do not leave dead Arc code.

============================================================
42. FINAL CLEANUP
============================================================

After migration:

There should be NO active Arc/EVM blockchain functionality.

The application should use:

SOLANA DEVNET
+
SOLANA USDC
+
SOLANA WALLET ADAPTER

Search again for:

Arc
5042002
arc-testnet.drpc.org
ethers
viem
wagmi
EVM
Ethereum
ERC20

and verify there are no remaining active references.

Comments/documentation referring to the old Arc implementation should also be updated.

============================================================
43. FINAL REPORT
============================================================

After implementation provide:

1. Files changed
2. Files removed
3. Files created
4. Removed Arc/EVM dependencies
5. Added Solana dependencies
6. Solana wallet adapter implementation
7. User wallet connection
8. Admin wallet connection
9. Solana USDC purchase flow
10. Solana withdrawal flow
11. Backend transaction verification
12. Database changes
13. Environment variables
14. Migration commands
15. Testing steps
16. Any remaining manual configuration
17. Any issues or limitations

IMPORTANT FINAL REQUIREMENT:

Do not implement Solana as an additional chain.

This is a migration:

ARC/EVM → SOLANA

The final blockchain/payment architecture must be Solana-based.