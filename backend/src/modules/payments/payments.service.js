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
    console.error('CHAPA INIT ERROR:', err.response ? err.response.data : err.message);
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

const { initializeTransaction, verifyTransaction } = require('../../config/chapa');

function randomTxRef() {
  return `dmhms-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function initializeChapaPayment({ invoice_id, method, email }) {
  const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
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

  const paidResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1 AND status = 'success'`,
    [invoice_id]
  );
  const remaining = Number(invoice.total_amount) - Number(paidResult.rows[0].paid);
  if (remaining <= 0) {
    const err = new Error('No outstanding balance on this invoice');
    err.status = 409;
    throw err;
  }

  const tx_ref = randomTxRef();

  await pool.query(
    `INSERT INTO payments (transaction_id, invoice_id, amount, method, chapa_tx_ref, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [tx_ref, invoice_id, remaining, method, tx_ref]
  );

  let chapaResponse;
  try {
    chapaResponse = await initializeTransaction({
      amount: remaining,
      currency: 'ETB',
      email,
      tx_ref,
      return_url: process.env.CHAPA_RETURN_URL || 'http://localhost:5000/api/payments/chapa/return',
    });
    } catch (err) {
    await pool.query(`UPDATE payments SET status = 'failed' WHERE chapa_tx_ref = $1`, [tx_ref]);
    const wrapped = new Error('Failed to initialize Chapa transaction');
    wrapped.status = 502;
    throw wrapped;
  }
  return { tx_ref, checkout_url: chapaResponse.data.checkout_url };
}

async function handleChapaWebhook(tx_ref) {
  const paymentResult = await pool.query('SELECT * FROM payments WHERE chapa_tx_ref = $1', [tx_ref]);
  const payment = paymentResult.rows[0];
  if (!payment) {
    const err = new Error('Unknown transaction reference');
    err.status = 404;
    throw err;
  }

  if (payment.status !== 'pending') {
    return { message: 'Already processed', payment };
  }

  let verification;
  try {
    verification = await verifyTransaction(tx_ref);
  } catch (err) {
    const wrapped = new Error('Failed to verify transaction with Chapa');
    wrapped.status = 502;
    throw wrapped;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (verification.data && verification.data.status === 'success') {
      await client.query(`UPDATE payments SET status = 'success' WHERE id = $1`, [payment.id]);

      const invoiceResult = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [payment.invoice_id]);
      const invoice = invoiceResult.rows[0];
      const paidResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1 AND status = 'success'`,
        [payment.invoice_id]
      );
      const totalPaid = Number(paidResult.rows[0].paid);
      const newStatus = totalPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';

      await client.query(`UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, payment.invoice_id]);
    } else {
      await client.query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [payment.id]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updated = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
  return { message: 'Processed', payment: updated.rows[0] };
}

module.exports.initializeChapaPayment = initializeChapaPayment;
module.exports.handleChapaWebhook = handleChapaWebhook;
