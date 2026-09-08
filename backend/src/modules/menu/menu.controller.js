const { listMenu, getMenuItemById, createMenuItem, updateMenuItem, deactivateMenuItem } = require('./menu.service');

async function getMenu(req, res) {
  try {
    const { category } = req.query;
    const isStaff = ['admin', 'manager', 'receptionist'].includes(req.user.role);
    const items = await listMenu({ category, includeUnavailable: isStaff });
    res.json(items);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getMenuItem(req, res) {
  try {
    const item = await getMenuItemById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    res.json(item);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postMenuItem(req, res) {
  try {
    const { name, category, price, description } = req.body;
    if (!name || !category || price === undefined) {
      return res.status(400).json({ message: 'name, category, and price are required' });
    }
    const item = await createMenuItem({ name, category, price, description });
    res.status(201).json(item);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function putMenuItem(req, res) {
  try {
    const item = await updateMenuItem(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function deleteMenuItem(req, res) {
  try {
    const item = await deactivateMenuItem(req.params.id);
    res.json({ message: 'Menu item deactivated', item });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { getMenu, getMenuItem, postMenuItem, putMenuItem, deleteMenuItem };
