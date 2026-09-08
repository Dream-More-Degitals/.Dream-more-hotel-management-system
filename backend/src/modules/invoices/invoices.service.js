const pool = require('../../config/db');

const TAX_RATE = 0.15; // 15% — adjust if your team specifies a different rate

function randomSuffix() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateInvoice({ reservation_id, discount = 0, created_by }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reservationResult = await client.query(
      'SELECT * FROM reservations WHERE id = $1 FOR UPDATE',
      [reservation_id]
    );
    const reservation = reservationResult.rows[0];
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }

    const existingInvoice = await client.query(
      'SELECT id FROM invoices WHERE reservation_id = $1',
      [reservation_id]
    );
    if (existingInvoice.rows.length > 0) {
      const err = new Error('An invoice already exists for this reservation');
      err.status = 409;
      throw err;
    }

    const room_charges = Number(reservation.total_cost);

    // FR-4.2.3.3 — only delivered food orders can be billed
    const foodResult = await client.query(
      `SELECT COALESCE(SUM(subtotal), 0) AS total
       FROM food_orders
       WHERE reservation_id = $1 AND status = 'delivered'`,
      [reservation_id]
    );
    const food_charges = Number(foodResult.rows[0].total);

    const subtotal = room_charges + food_charges - Number(discount);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total_amount = Math.round((subtotal + tax) * 100) / 100;

    let invoice_number, invoice;
    for (let attempt = 0; attempt < 5; attempt++) {
      invoice_number = `INV-${randomSuffix()}`;
      try {
        const result = await client.query(
          `INSERT INTO invoices
             (invoice_number, reservation_id, customer_id, room_charges, food_charges, tax, discount, total_amount, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [invoice_number, reservation_id, reservation.customer_id, room_charges, food_charges, tax, discount, total_amount, created_by]
        );
        invoice = result.rows[0];
        break;
      } catch (e) {
        if (e.code === '23505') continue;
        throw e;
      }
    }
    if (!invoice) throw new Error('Could not generate a unique invoice number, please retry');

    await client.query('COMMIT');
    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getInvoiceById(id) {
  const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
  return result.rows[0];
}

async function listInvoices({ user, status } = {}) {
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
  const result = await pool.query(`SELECT * FROM invoices ${where} ORDER BY created_at DESC`, values);
  return result.rows;
}

async function getAmountPaid(invoiceId) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid
     FROM payments WHERE invoice_id = $1 AND status = 'success'`,
    [invoiceId]
  );
  return Number(result.rows[0].paid);
}

module.exports = { generateInvoice, getInvoiceById, listInvoices, getAmountPaid };
