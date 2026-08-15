const bcrypt = require('bcrypt');
const { supabase } = require('./supabase');

const SALT_ROUNDS = 10;

async function createUser({ email, password, firstName, lastName }) {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash,
      first_name: firstName || null,
      last_name: lastName || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

module.exports = { createUser, getUserByEmail, getUserById, verifyPassword };
