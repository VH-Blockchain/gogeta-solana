import { PrismaClient, CoinTxnType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const p = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('Harness#1234', 10);
  const u = await p.user.upsert({
    where: { email: 'wd-conc-harness@example.local' },
    update: { passwordHash: hash, coins: 2000 },
    create: { email: 'wd-conc-harness@example.local', name: 'WD Conc', username: 'wd-conc-h',
              passwordHash: hash, role: 'USER', isVerified: true, coins: 2000 },
  });
  await p.withdrawalRequest.deleteMany({ where: { userId: u.id } });
  await p.coinTransaction.deleteMany({ where: { userId: u.id } });
  await p.coinTransaction.create({
    data: { userId: u.id, type: CoinTxnType.POINT_PURCHASE, amount: 2000, balanceAfter: 2000, description: 'harness' },
  });
  console.log('concurrency user ready with exactly 2000 withdrawable');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
