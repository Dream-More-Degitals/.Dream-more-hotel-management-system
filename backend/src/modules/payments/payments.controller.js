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
