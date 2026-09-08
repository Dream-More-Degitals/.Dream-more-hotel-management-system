const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { postInvoice, getInvoices, getInvoice } = require('./invoices.controller');

router.post('/', requireAuth, requireRole('admin', 'manager', 'receptionist'), postInvoice);
router.get('/', requireAuth, getInvoices);
router.get('/:id', requireAuth, getInvoice);

module.exports = router;
