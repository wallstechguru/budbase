const nodemailer = require('nodemailer');
const { formatPrice } = require('./format');
const paymentMethods = require('./payment-methods');

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

// `to` defaults to the store owner's inbox (order/signup/contact
// notifications); customer-facing emails pass the customer's own address.
async function sendNotification(subject, text, to = process.env.ORDER_NOTIFY_EMAIL || process.env.SMTP_USER) {
  const transport = getTransport();

  if (!transport) {
    console.log(`--- ${subject} (to: ${to}) (SMTP not configured, logging instead) ---`);
    console.log(text);
    console.log('-------------------------------------------------------------');
    return;
  }

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

function formatOrderConfirmationText(order) {
  const lines = order.items.map(
    (item) => `  ${item.quantity} x ${item.product_name} (${item.size_label}) — ${formatPrice(item.unit_price * item.quantity)}`
  );

  const method = paymentMethods.find((m) => m.value === order.payment_method);
  const methodLabel = method
    ? `${method.label}${order.crypto_network && method.networks ? ' — ' + method.networks.find((n) => n.value === order.crypto_network).label : ''}`
    : order.payment_method;

  return [
    `Thank you for your order, ${order.full_name.split(' ')[0]}!`,
    '',
    `Order #${order.id} has been received and is pending manual processing. We'll be in touch shortly to confirm payment and next steps.`,
    '',
    `Payment method: ${methodLabel}`,
    ...(method ? [method.instructions] : []),
    '',
    'Order Summary:',
    ...lines,
    '',
    `Subtotal: ${formatPrice(order.subtotal)}`,
    '',
    `Delivery to: ${order.address}`,
    `Contact: ${order.email}${order.phone ? ' · ' + order.phone : ''}`,
    '',
    'Thanks for shopping with BudBase!',
  ].join('\n');
}

function sendOrderConfirmation(order) {
  return sendNotification(`Order Confirmation — BudBase #${order.id}`, formatOrderConfirmationText(order), order.email);
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

module.exports = { sendOrderNotification, sendOrderConfirmation, sendSignupNotification, sendContactNotification };
