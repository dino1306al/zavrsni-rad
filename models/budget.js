const db = require('../db');

const Budget = {
  async create(userId, category, amount, month) {
    const [result] = await db.execute(
      'INSERT INTO budgets (user_id, category, amount, month) VALUES (?, ?, ?, ?)',
      [userId, category, amount, month]
    );
    return result;
  },

  async findByUserId(userId) {
    const [rows] = await db.execute(
      'SELECT * FROM budgets WHERE user_id = ? ORDER BY month DESC, category',
      [userId]
    );
    return rows;
  },

  async update(id, userId, amount) {
    const [result] = await db.execute(
      'UPDATE budgets SET amount = ? WHERE id = ? AND user_id = ?',
      [amount, id, userId]
    );
    return result;
  },

  async deleteById(id, userId) {
    const [result] = await db.execute(
      'DELETE FROM budgets WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result;
  },

  async getByMonth(userId, month) {
    const [rows] = await db.execute(
      'SELECT * FROM budgets WHERE user_id = ? AND month = ?',
      [userId, month]
    );
    return rows;
  }
};

module.exports = Budget;