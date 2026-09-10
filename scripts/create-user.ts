/**
 * Creează (sau actualizează) un utilizator — npm run db:create-user -- <email> "<nume>" <parolă>
 * Idempotent pe email: dacă userul există, îi actualizează numele și parola și îl reactivează
 * (util ca reset de urgență când nu mai e niciun admin care să poată intra).
 */
import { prisma } from '../lib/db';
import { hashPassword, MIN_PASSWORD_LENGTH, normalizeEmail } from '../lib/auth/password';

async function main() {
  const [rawEmail, name, password] = process.argv.slice(2);
  if (!rawEmail || !name || !password) {
    console.error('Utilizare: npm run db:create-user -- <email> "<nume>" <parolă>');
    process.exit(1);
  }
  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Email invalid: ${rawEmail}`);
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: name.trim(), passwordHash, active: true },
    create: { email, name: name.trim(), passwordHash },
  });
  console.log(`${existing ? 'Actualizat' : 'Creat'}: ${user.name} <${user.email}> (${user.id})`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
