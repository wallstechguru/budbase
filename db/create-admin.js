// Creates a new admin user, or promotes an existing account to admin.
// Usage: node db/create-admin.js you@example.com yourpassword123
require('dotenv').config();
const { createUser, getUserByEmail } = require('../lib/auth');
const { supabase } = require('../lib/supabase');

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node db/create-admin.js <email> <password>');
    process.exit(1);
  }

  const existing = await getUserByEmail(email);
  const userId = existing ? existing.id : (await createUser({ email, password, firstName: 'Admin', lastName: '' })).id;

  const { error } = await supabase.from('users').update({ is_admin: true }).eq('id', userId);
  if (error) throw error;

  console.log(existing ? `Promoted existing account to admin: ${email}` : `Created admin account: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
