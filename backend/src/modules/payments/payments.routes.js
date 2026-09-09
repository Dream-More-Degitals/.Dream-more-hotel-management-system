const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const {
  postPayment,
  getPayment,
  getInvoicePayments,
  postChapaInitialize,
  postChapaWebhook,
} = require('./payments.controller');

router.post('/', requireAuth, requireRole('admin', 'manager', 'receptionist'), postPayment);
router.get('/:id', requireAuth, getPayment);
router.get('/invoice/:invoiceId', requireAuth, getInvoicePayments);

router.post('/chapa/initialize', requireAuth, postChapaInitialize);
router.post('/chapa/webhook', postChapaWebhook);

module.exports = router;
