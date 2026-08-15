const { supabase } = require('./supabase');

function flattenCartRow(row) {
  return {
    cart_item_id: row.id,
    quantity: row.quantity,
    variant_id: row.variants.id,
    size_label: row.variants.size_label,
    price: row.variants.price,
    product_name: row.variants.products.name,
    product_slug: row.variants.products.slug,
    product_image: row.variants.products.image,
    brand_name: row.variants.products.brands ? row.variants.products.brands.name : null,
  };
}

async function getCartItems(sessionId) {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id, quantity,
      variants (
        id, size_label, price,
        products ( name, slug, image, brands ( name ) )
      )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(flattenCartRow);
}

async function getCartSummary(sessionId) {
  const items = await getCartItems(sessionId);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return { items, count, subtotal };
}

async function addToCart(sessionId, variantId, quantity) {
  const { data: existing, error: findError } = await supabase
    .from('cart_items')
    .select('*')
    .eq('session_id', sessionId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({ session_id: sessionId, variant_id: variantId, quantity });
    if (error) throw error;
  }
}

async function removeFromCart(sessionId, cartItemId) {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('session_id', sessionId);
  if (error) throw error;
}

async function updateCartItem(sessionId, cartItemId, quantity) {
  if (quantity <= 0) {
    await removeFromCart(sessionId, cartItemId);
  } else {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId)
      .eq('session_id', sessionId);
    if (error) throw error;
  }
}

async function clearCart(sessionId) {
  const { error } = await supabase.from('cart_items').delete().eq('session_id', sessionId);
  if (error) throw error;
}

module.exports = { getCartItems, getCartSummary, addToCart, removeFromCart, updateCartItem, clearCart };
