const db = require('../db');

const Expense = {
  // Kreiraj novi trošak
  async create(userId, amount, description, date, category, isRecurring = false, recurrenceInterval = null, recurrenceEndDate = null) {
    const [result] = await db.execute(
      `INSERT INTO expenses 
      (user_id, amount, description, date, category, is_recurring, recurrence_interval, recurrence_end_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, amount, description, date, category, isRecurring, recurrenceInterval, recurrenceEndDate]
    );
    return result;
  },

  // Dohvati sve troškove korisnika
  async findByUserId(userId) {
    const [rows] = await db.execute(
      'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    return rows;
  },

  // Dohvati troškove korisnika za određeni mjesec
  async findByUserIdAndMonth(userId, month) {
    const [rows] = await db.execute(
      `SELECT * FROM expenses 
      WHERE user_id = ? AND DATE_FORMAT(date, '%Y-%m') = ? 
      ORDER BY date DESC`,
      [userId, month]
    );
    return rows;
  },

  // Dohvati ponavljajuće troškove
  async getRecurringExpenses(userId) {
    const [rows] = await db.execute(
      `SELECT * FROM expenses 
      WHERE user_id = ? AND is_recurring = TRUE 
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= CURDATE())
      ORDER BY date DESC`,
      [userId]
    );
    return rows;
  },

  // Dohvati ukupne troškove po kategorijama za određeni mjesec
  async getTotalByCategory(userId, month) {
    const [rows] = await db.execute(
      `SELECT category, SUM(amount) as total 
      FROM expenses 
      WHERE user_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?
      GROUP BY category`,
      [userId, month]
    );
    return rows;
  },

  // Dohvati mjesečne troškove korisnika za zadani broj mjeseci
  async getMonthlyExpenses(userId, months) {
    const [rows] = await db.execute(
      `SELECT 
        DATE_FORMAT(date, '%Y-%m') as month, 
        SUM(amount) as total 
      FROM expenses 
      WHERE user_id = ? 
      GROUP BY DATE_FORMAT(date, '%Y-%m') 
      ORDER BY month DESC 
      LIMIT ?`,
      [userId, parseInt(months)]
    );
    return rows;
  },

  // Obriši trošak prema ID-u
  async deleteById(id, userId) {
    const [result] = await db.execute(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result;
  },

  // Ažuriraj trošak
  async update(id, userId, data) {
    const [result] = await db.execute(
      `UPDATE expenses SET 
        amount = ?, 
        description = ?, 
        date = ?, 
        category = ?,
        is_recurring = ?,
        recurrence_interval = ?,
        recurrence_end_date = ?
      WHERE id = ? AND user_id = ?`,
      [
        data.amount,
        data.description,
        data.date,
        data.category,
        data.isRecurring,
        data.recurrenceInterval,
        data.recurrenceEndDate,
        id,
        userId
      ]
    );
    return result;
  }
};

module.exports = Expense;
