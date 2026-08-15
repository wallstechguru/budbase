const nodemailer = require('nodemailer');
const { formatPrice } = require('./format');

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function sendNotification(subject, text) {
  const transport = getTransport();

  if (!transport) {
    console.log(`--- ${subject} (SMTP not configured, logging instead) ---`);
    console.log(text);
    console.log('-------------------------------------------------------------');
    return;
  }

  const to = process.env.ORDER_NOTIFY_EMAIL || process.env.SMTP_USER;
  try {
    await transport.sendMail({ from: process.env.SMTP_USER, to, subject, text });
  } catch (err) {
    console.error(`Failed to send "${subject}" email:`, err.message);
    console.log(text);
  }
}

function formatOrderText(order) {
  const lines = order.items.map(
    (item) => `  ${item.quantity} x ${item.product_name} (${item.size_label}) — ${formatPrice(item.unit_price * item.quantity)}`
  );

  return [
    `New BudBase order #${order.id} — pending manual processing`,
    '',
    `Customer: ${order.full_name} <${order.email}>${order.phone ? ' — ' + order.phone : ''}`,
    `Delivery to: ${order.address}`,
    `Payment method: ${order.payment_method}${order.crypto_network ? ' (' + order.crypto_network.toUpperCase() + ')' : ''}`,
    '',
    'Items:',
    ...lines,
    '',
    `Subtotal: ${formatPrice(order.subtotal)}`,
  ].join('\n');
}

function sendOrderNotification(order) {
  return sendNotification(`New BudBase order #${order.id}`, formatOrderText(order));
}

function sendSignupNotification(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '(no name given)';
  const text = [
    'New BudBase account created',
    '',
    `Name: ${name}`,
    `Email: ${user.email}`,
    `Signed up: ${user.created_at}`,
  ].join('\n');

  return sendNotification(`New BudBase signup: ${user.email}`, text);
}

function sendContactNotification(message) {
  const text = [
    'New BudBase contact form message',
    '',
    `From: ${message.name} <${message.email}>`,
    '',
    message.message,
  ].join('\n');

  return sendNotification(`New BudBase contact message from ${message.name}`, text);
}

module.exports = { sendOrderNotification, sendSignupNotification, sendContactNotification };
