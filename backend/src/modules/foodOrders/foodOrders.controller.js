const {
  createFoodOrder,
  getFoodOrderById,
  listFoodOrders,
  updateFoodOrderStatus,
  cancelFoodOrder,
} = require('./foodOrders.service');

async function postFoodOrder(req, res) {
  try {
    const { reservation_id, room_number, items, customer_id } = req.body;
    const finalCustomerId = req.user.role === 'customer' ? req.user.id : (customer_id || req.user.id);

    const order = await createFoodOrder({
      customer_id: finalCustomerId,
      reservation_id,
      room_number,
      items,
    });
    res.status(201).json(order);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getFoodOrders(req, res) {
  try {
    const { status } = req.query;
    const orders = await listFoodOrders({ user: req.user, status });
    res.json(orders);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getFoodOrder(req, res) {
  try {
    const order = await getFoodOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Food order not found' });
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function patchFoodOrderStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });
    const order = await updateFoodOrderStatus(req.params.id, status);
    res.json(order);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postCancelFoodOrder(req, res) {
  try {
    const order = await cancelFoodOrder(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { postFoodOrder, getFoodOrders, getFoodOrder, patchFoodOrderStatus, postCancelFoodOrder };
