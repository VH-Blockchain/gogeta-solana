import { PrismaClient, CoinTxnType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const p = new PrismaClient();

/** Builds a user with a known ledger mix, so withdrawable is predictable. */
async function seedUser(email: string, username: string, ledger: [CoinTxnType, number][]) {
  const hash = await bcrypt.hash('Harness#1234', 10);
  const u = await p.user.upsert({
    where: { email },
    update: { passwordHash: hash, coins: 0 },
    create: { email, name: username, username, passwordHash: hash, role: 'USER', isVerified: true, coins: 0 },
  });
  await p.withdrawalRequest.deleteMany({ where: { userId: u.id } });
  await p.coinTransaction.deleteMany({ where: { userId: u.id } });
  let bal = 0;
  for (const [type, amount] of ledger) {
    bal += amount;
    await p.coinTransaction.create({
      data: { userId: u.id, type, amount, balanceAfter: bal, description: 'harness' },
    });
  }
  await p.user.update({ where: { id: u.id }, data: { coins: bal } });
  return { id: u.id, balance: bal };
}

(async () => {
  const hash = await bcrypt.hash('Harness#1234', 10);
  await p.user.upsert({
    where: { email: 'wd-admin-harness@example.local' },
    update: { passwordHash: hash, role: 'ADMIN' },
    create: { email: 'wd-admin-harness@example.local', name: 'WD Admin', username: 'wd-admin-h',
              passwordHash: hash, role: 'ADMIN', isVerified: true },
  });

  // §33's exact example: signup 100, purchase 2000, prediction 500, quiz 300,
  // lucky 500 => withdrawable 2800, total 3400.
  const spec = await seedUser('wd-spec-harness@example.local', 'wd-spec-h', [
    [CoinTxnType.SIGNUP_BONUS, 100],
    [CoinTxnType.POINT_PURCHASE, 2000],
    [CoinTxnType.CORRECT_REWARD, 500],
    [CoinTxnType.QUIZ_REWARD, 300],
    [CoinTxnType.LUCKY_BONUS, 500],
  ]);
  console.log('spec user   balance', spec.balance, '(expect 3400, withdrawable 2800)');

  // Gifts only — must be able to withdraw nothing.
  const gift = await seedUser('wd-gift-harness@example.local', 'wd-gift-h', [
    [CoinTxnType.SIGNUP_BONUS, 100],
    [CoinTxnType.BONUS, 900],
  ]);
  console.log('gift user   balance', gift.balance, '(expect 1000, withdrawable 0)');

  // Below the minimum.
  const small = await seedUser('wd-small-harness@example.local', 'wd-small-h', [
    [CoinTxnType.POINT_PURCHASE, 800],
  ]);
  console.log('small user  balance', small.balance, '(expect 800, below the 1000 minimum)');

  // Spending eats gifts first, then own money.
  const spent = await seedUser('wd-spent-harness@example.local', 'wd-spent-h', [
    [CoinTxnType.SIGNUP_BONUS, 600],
    [CoinTxnType.POINT_PURCHASE, 2800],
    [CoinTxnType.ENTRY_FEE, -1000],
  ]);
  console.log('spent user  balance', spent.balance, '(expect 2400, withdrawable 2400)');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
