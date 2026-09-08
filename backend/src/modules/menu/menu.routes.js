const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { getMenu, getMenuItem, postMenuItem, putMenuItem, deleteMenuItem } = require('./menu.controller');

router.get('/', requireAuth, getMenu);
router.get('/:id', requireAuth, getMenuItem);
router.post('/', requireAuth, requireRole('admin'), postMenuItem);
router.put('/:id', requireAuth, requireRole('admin'), putMenuItem);
router.delete('/:id', requireAuth, requireRole('admin'), deleteMenuItem);

module.exports = router;
