const pool = require('../../config/db');

function randomSuffix() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function recordPayment({ invoice_id, amount, method, staff_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [invoice_id]);
    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.status = 404;
      throw err;
    }
    if (invoice.status === 'paid') {
      const err = new Error('Invoice is already fully paid');
      err.status = 409;
      throw err;
    }

    const paidResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1 AND status = 'success'`,
      [invoice_id]
    );
    const alreadyPaid = Number(paidResult.rows[0].paid);
    const remaining = Number(invoice.total_amount) - alreadyPaid;

    if (!(amount > 0)) {
      const err = new Error('Payment amount must be greater than zero');
      err.status = 400;
      throw err;
    }
    if (amount > remaining) {
      const err = new Error(`Payment amount exceeds the outstanding balance of ${remaining.toFixed(2)}`);
      err.status = 400;
      throw err;
    }

    let transaction_id, payment;
    for (let attempt = 0; attempt < 5; attempt++) {
      transaction_id = `TXN-${randomSuffix()}`;
      try {
        const result = await client.query(
          `INSERT INTO payments (transaction_id, invoice_id, amount, method, status, staff_id)
           VALUES ($1, $2, $3, $4, 'success', $5)
           RETURNING *`,
          [transaction_id, invoice_id, amount, method, staff_id]
        );
        payment = result.rows[0];
        break;
      } catch (e) {
        if (e.code === '23505') continue;
        throw e;
      }
    }
    if (!payment) throw new Error('Could not generate a unique transaction ID, please retry');

    const newTotalPaid = alreadyPaid + Number(amount);
    const newStatus = newTotalPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';

    await client.query(
      `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, invoice_id]
    );

    await client.query('COMMIT');
    return { ...payment, invoice_status: newStatus, remaining_balance: Number(invoice.total_amount) - newTotalPaid };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listPaymentsForInvoice(invoice_id) {
  const result = await pool.query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
    [invoice_id]
  );
  return result.rows;
}

async function getPaymentById(id) {
  const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
  return result.rows[0];
}

module.exports = { recordPayment, listPaymentsForInvoice, getPaymentById };
