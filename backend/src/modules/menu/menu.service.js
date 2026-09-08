const pool = require('../../config/db');

async function listMenu({ category, includeUnavailable = false } = {}) {
  const conditions = [];
  const values = [];

  if (!includeUnavailable) {
    conditions.push('is_available = true');
  }
  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM menu_items ${where} ORDER BY category, name`, values);
  return result.rows;
}

async function getMenuItemById(id) {
  const result = await pool.query('SELECT * FROM menu_items WHERE id = $1', [id]);
  return result.rows[0];
}

async function createMenuItem({ name, category, price, description }) {
  if (!(price > 0)) {
    const err = new Error('Menu item price must be a positive number greater than zero');
    err.status = 400;
    throw err;
  }
  const result = await pool.query(
    `INSERT INTO menu_items (name, category, price, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, category, price, description || null]
  );
  return result.rows[0];
}

async function updateMenuItem(id, updates) {
  const item = await getMenuItemById(id);
  if (!item) {
    const err = new Error('Menu item not found');
    err.status = 404;
    throw err;
  }
  if (updates.price !== undefined && !(updates.price > 0)) {
    const err = new Error('Menu item price must be a positive number greater than zero');
    err.status = 400;
    throw err;
  }

  const fields = ['name', 'category', 'price', 'description', 'is_available'];
  const setClauses = [];
  const values = [];
  fields.forEach((field) => {
    if (updates[field] !== undefined) {
      values.push(updates[field]);
      setClauses.push(`${field} = $${values.length}`);
    }
  });
  if (setClauses.length === 0) return item;

  values.push(id);
  const result = await pool.query(
    `UPDATE menu_items SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values
  );
  return result.rows[0];
}

async function deactivateMenuItem(id) {
  return updateMenuItem(id, { is_available: false });
}

module.exports = { listMenu, getMenuItemById, createMenuItem, updateMenuItem, deactivateMenuItem };
