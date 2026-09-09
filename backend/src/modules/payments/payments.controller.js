const { recordPayment, listPaymentsForInvoice, getPaymentById } = require('./payments.service');

async function postPayment(req, res) {
  try {
    const { invoice_id, amount, method } = req.body;
    if (!invoice_id || amount === undefined || !method) {
      return res.status(400).json({ message: 'invoice_id, amount, and method are required' });
    }
    const payment = await recordPayment({ invoice_id, amount, method, staff_id: req.user.id });
    res.status(201).json(payment);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getPayment(req, res) {
  try {
    const payment = await getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getInvoicePayments(req, res) {
  try {
    const payments = await listPaymentsForInvoice(req.params.invoiceId);
    res.json(payments);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { postPayment, getPayment, getInvoicePayments };

const { initializeChapaPayment, handleChapaWebhook } = require('./payments.service');

async function postChapaInitialize(req, res) {
  try {
    const { invoice_id, method, email } = req.body;
    if (!invoice_id || !method || !email) {
      return res.status(400).json({ message: 'invoice_id, method, and email are required' });
    }
    const result = await initializeChapaPayment({ invoice_id, method, email });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postChapaWebhook(req, res) {
  try {
    const tx_ref = req.body.tx_ref || req.query.tx_ref;
    if (!tx_ref) return res.status(400).json({ message: 'tx_ref is required' });
    const result = await handleChapaWebhook(tx_ref);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports.postChapaInitialize = postChapaInitialize;
module.exports.postChapaWebhook = postChapaWebhook;
