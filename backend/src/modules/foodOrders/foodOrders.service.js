const pool = require('../../config/db');

function randomSuffix() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

async function createFoodOrder({ customer_id, reservation_id, room_number, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('An order must include at least one item');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const resolvedItems = [];
    for (const { menu_item_id, quantity } of items) {
      if (!(quantity > 0)) {
        const err = new Error('Quantity must be greater than zero');
        err.status = 400;
        throw err;
      }
      const menuResult = await client.query(
        'SELECT * FROM menu_items WHERE id = $1 AND is_available = true',
        [menu_item_id]
      );
      const menuItem = menuResult.rows[0];
      if (!menuItem) {
        const err = new Error(`Menu item ${menu_item_id} is unavailable or does not exist`);
        err.status = 409;
        throw err;
      }
      const lineTotal = Number(menuItem.price) * quantity;
      subtotal += lineTotal;
      resolvedItems.push({ menu_item_id, quantity, unit_price: menuItem.price });
    }

    let order_code, order;
    for (let attempt = 0; attempt < 5; attempt++) {
      order_code = `ORD-${randomSuffix()}`;
      try {
        const result = await client.query(
          `INSERT INTO food_orders (order_code, customer_id, reservation_id, room_number, subtotal, status)
           VALUES ($1, $2, $3, $4, $5, 'received') RETURNING *`,
          [order_code, customer_id, reservation_id || null, room_number || null, subtotal]
        );
        order = result.rows[0];
        break;
      } catch (e) {
        if (e.code === '23505') continue;
        throw e;
      }
    }
    if (!order) throw new Error('Could not generate a unique order code, please retry');

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO food_order_items (food_order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');
    return { ...order, items: resolvedItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getFoodOrderById(id) {
  const orderResult = await pool.query('SELECT * FROM food_orders WHERE id = $1', [id]);
  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await pool.query(
    `SELECT foi.quantity, foi.unit_price, mi.name, mi.category
     FROM food_order_items foi
     JOIN menu_items mi ON mi.id = foi.menu_item_id
     WHERE foi.food_order_id = $1`,
    [id]
  );
  return { ...order, items: itemsResult.rows };
}

async function listFoodOrders({ user, status } = {}) {
  const conditions = [];
  const values = [];

  if (user.role === 'customer') {
    values.push(user.id);
    conditions.push(`customer_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM food_orders ${where} ORDER BY created_at DESC`, values);
  return result.rows;
}

const ALLOWED_STATUS_TRANSITIONS = {
  received: ['preparing', 'cancelled'],
  preparing: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

async function updateFoodOrderStatus(id, newStatus) {
  const validStatuses = Object.keys(ALLOWED_STATUS_TRANSITIONS);
  if (!validStatuses.includes(newStatus)) {
    const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const result = await pool.query('SELECT * FROM food_orders WHERE id = $1', [id]);
  const order = result.rows[0];
  if (!order) {
    const err = new Error('Food order not found');
    err.status = 404;
    throw err;
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Cannot transition order from '${order.status}' to '${newStatus}'`);
    err.status = 400;
    throw err;
  }

  const updated = await pool.query(
    'UPDATE food_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, id]
  );
  return updated.rows[0];
}

async function cancelFoodOrder(id) {
  const result = await pool.query('SELECT * FROM food_orders WHERE id = $1', [id]);
  const order = result.rows[0];
  if (!order) {
    const err = new Error('Food order not found');
    err.status = 404;
    throw err;
  }
  if (order.status === 'delivered') {
    const err = new Error('Cannot cancel an order that has already been delivered');
    err.status = 409;
    throw err;
  }
  if (order.status === 'cancelled') {
    const err = new Error('Order is already cancelled');
    err.status = 409;
    throw err;
  }

  const updated = await pool.query(
    `UPDATE food_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return updated.rows[0];
}

module.exports = {
  createFoodOrder,
  getFoodOrderById,
  listFoodOrders,
  updateFoodOrderStatus,
  cancelFoodOrder,
};
