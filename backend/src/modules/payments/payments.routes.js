const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { postPayment, getPayment, getInvoicePayments } = require('./payments.controller');

router.post('/', requireAuth, requireRole('admin', 'manager', 'receptionist'), postPayment);
router.get('/:id', requireAuth, getPayment);
router.get('/invoice/:invoiceId', requireAuth, getInvoicePayments);

module.exports = router;
