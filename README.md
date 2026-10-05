# GOGETA Solana

GOGETA is a prediction and rewards platform on the Solana blockchain. It allows users to purchase points using USDC (SPL Token) and withdraw them, featuring a comprehensive economy system, predictions, and an admin management portal.


## 🛠 Technical Stack

| Component | Technology |
| :--- | :--- |
| **Backend** | NestJS, Prisma, PostgreSQL, Redis |
| **Admin Frontend** | Next.js, Tailwind CSS, Recharts |
| **User Frontend** | React, Vite, MUI |
| **Blockchain** | Solana Web3.js, SPL Token, Solana Wallet Adapter |


## 🏗 Project Structure

The project is divided into three main components:

- **`backend/`**: NestJS API handling business logic, Solana transaction verification, and database management (Prisma).
- **`admin_frontend/`**: Next.js application for administrators to manage users, approve withdrawals, and monitor the platform.
- **`user_frontend_react/`**: React + Vite application for end-users to interact with predictions, purchase points, and manage their profiles.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v20+ recommended)
- **npm** or **yarn**
- **PostgreSQL** (for the backend database)
- **Solana Wallet** (e.g., Phantom or Solflare)

### 1. Backend Setup

```bash
cd backend
npm install
```

**Environment Configuration:**
Create a `.env` file in the `backend/` directory based on `.env.example`:
- `DATABASE_URL`: PostgreSQL connection string.
- `SOLANA_RPC_URL`: e.g., `https://api.devnet.solana.com`
- `SOLANA_USDC_MINT`: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- `SOLANA_TREASURY_ADDRESS`: The platform's receiving wallet.
- `JWT_SECRET`: Secret key for authentication.

**Database Initialization:**
```bash
npx prisma generate
npx prisma migrate dev
npm run seed
```

**Run Backend:**
```bash
npm run start:dev
```

### 2. Admin Frontend Setup

```bash
cd admin_frontend
npm install
```

**Environment Configuration:**
Create a `.env` file in the `admin_frontend/` directory based on `.env.example`:
- `NEXT_PUBLIC_API_BASE`: URL of the backend API (e.g., `http://localhost:4000/api`).
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Solana Devnet RPC.
- `NEXT_PUBLIC_SOLANA_USDC_MINT`: USDC SPL mint address.

**Run Admin Frontend:**
```bash
npm run dev
```
Access at: `http://localhost:3000`

### 3. User Frontend Setup

```bash
cd user_frontend_react
npm install
```

**Environment Configuration:**
Create a `.env` file in the `user_frontend_react/` directory based on `.env.example`:
- `VITE_API_BASE`: URL of the backend API (e.g., `http://localhost:4000/api`).
- `VITE_SOLANA_RPC_URL`: Solana Devnet RPC.
- `VITE_SOLANA_USDC_MINT`: USDC SPL mint address.
- `VITE_SOLANA_TREASURY_ADDRESS`: The platform's receiving wallet.

**Run User Frontend:**
```bash
npm run dev
```
Access at: `http://localhost:5173`

---

## 📘 Key Features

- **Points Purchase**: Integrated Solana USDC (SPL) transfer with server-side verification.
- **Withdrawal System**: Admin-approved withdrawal flow utilizing Solana transfers.
- **Predictions & Quiz**: Gamified user engagement modules.
- **Leaderboards**: Real-time tracking of top users.
- **Admin Panel**: Full control over platform economy and user requests.

