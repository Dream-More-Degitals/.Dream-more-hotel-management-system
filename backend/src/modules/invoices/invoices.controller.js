const { generateInvoice, getInvoiceById, listInvoices, getAmountPaid } = require('./invoices.service');

async function postInvoice(req, res) {
  try {
    const { reservation_id, discount } = req.body;
    if (!reservation_id) {
      return res.status(400).json({ message: 'reservation_id is required' });
    }
    const invoice = await generateInvoice({ reservation_id, discount, created_by: req.user.id });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getInvoices(req, res) {
  try {
    const { status } = req.query;
    const invoices = await listInvoices({ user: req.user, status });
    res.json(invoices);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getInvoice(req, res) {
  try {
    const invoice = await getInvoiceById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role === 'customer' && invoice.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const amount_paid = await getAmountPaid(invoice.id);
    res.json({ ...invoice, amount_paid, balance: Number(invoice.total_amount) - amount_paid });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { postInvoice, getInvoices, getInvoice };
