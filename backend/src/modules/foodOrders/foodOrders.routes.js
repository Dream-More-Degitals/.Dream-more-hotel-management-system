const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const {
  postFoodOrder,
  getFoodOrders,
  getFoodOrder,
  patchFoodOrderStatus,
  postCancelFoodOrder,
} = require('./foodOrders.controller');

router.post('/', requireAuth, postFoodOrder);
router.get('/', requireAuth, getFoodOrders);
router.get('/:id', requireAuth, getFoodOrder);
router.patch('/:id/status', requireAuth, requireRole('admin', 'manager', 'receptionist'), patchFoodOrderStatus);
router.post('/:id/cancel', requireAuth, postCancelFoodOrder);

module.exports = router;
