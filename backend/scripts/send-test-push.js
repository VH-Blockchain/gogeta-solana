#!/usr/bin/env node
/**
 * One-off diagnostic: send a real push notification to a single user by
 * email, without touching the broadcast-to-everyone endpoint or any other
 * user. Prints exactly what's missing (env var, package, device token) if it
 * can't send, instead of failing silently.
 *
 * Usage: node scripts/send-test-push.js <email> ["title"] ["body"] [type]
 *   type: SYSTEM (default) | RESULT | LUCKY — controls the data.type payload,
 *   which is what the app uses to route a notification tap (see
 *   routesByType in firebase-messaging-sw.js / push_navigation.dart).
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/send-test-push.js <email> ["title"] ["body"]');
    process.exit(1);
  }
  const title = process.argv[3] || 'Test notification';
  const body = process.argv[4] || 'This is a diagnostic push sent directly from the server.';
  const type = (process.argv[5] || 'SYSTEM').toUpperCase();
  const validTypes = ['SYSTEM', 'RESULT', 'LUCKY'];
  if (!validTypes.includes(type)) {
    console.error(`Unknown type "${type}" — must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Found user: ${user.id} (${user.email})`);

  const tokens = await prisma.deviceToken.findMany({ where: { userId: user.id } });
  console.log(`Registered device tokens: ${tokens.length}`);
  for (const t of tokens) {
    console.log(`  - ${t.platform} token ending ...${t.token.slice(-8)} (updated ${t.updatedAt.toISOString()})`);
  }

  if (tokens.length === 0) {
    console.error('No device tokens registered for this user — nothing to send to. Log into the app on the device first, then re-run.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set in this environment — cannot send.');
    await prisma.$disconnect();
    process.exit(1);
  }

  let initializeApp, cert, getApps, getMessaging;
  try {
    ({ initializeApp, cert, getApps } = require('firebase-admin/app'));
    ({ getMessaging } = require('firebase-admin/messaging'));
  } catch (e) {
    console.error('firebase-admin is not installed/resolvable in node_modules:', e.message);
    console.error('Run scripts/deploy.sh (clean npm ci) first.');
    await prisma.$disconnect();
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const messaging = getMessaging();

  for (const t of tokens) {
    try {
      const id = await messaging.send({
        token: t.token,
        notification: { title, body },
        data: { type },
      });
      console.log(`Sent OK to ${t.platform} token ...${t.token.slice(-8)} -> messageId ${id}`);
    } catch (e) {
      console.error(`FAILED sending to ${t.platform} token ...${t.token.slice(-8)}:`, e.message);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
