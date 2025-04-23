const db = require('../db');

class Income {
  // Kreiraj novi prihod
  static async create(userId, amount, description, date, isRecurring = false, recurrenceInterval = null, recurrenceEndDate = null) {
    const [result] = await db.execute(
      `INSERT INTO income 
      (user_id, amount, description, date, is_recurring, recurrence_interval, recurrence_end_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, amount, description, date, isRecurring, recurrenceInterval, recurrenceEndDate]
    );
    return result;
  }

  // Dohvati sve prihode korisnika
  static async findByUserId(userId) {
    const [rows] = await db.execute(
      'SELECT * FROM income WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    return rows;
  }

  // Dohvati prihode korisnika za određeni mjesec
  static async findByUserIdAndMonth(userId, month) {
    const [rows] = await db.execute(
      `SELECT * FROM income 
      WHERE user_id = ? AND DATE_FORMAT(date, '%Y-%m') = ? 
      ORDER BY date DESC`,
      [userId, month]
    );
    return rows;
  }

  // Dohvati ponavljajuće prihode
  static async getRecurringIncome(userId) {
    const [rows] = await db.execute(
      `SELECT * FROM income 
      WHERE user_id = ? AND is_recurring = TRUE 
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= CURDATE())
      ORDER BY date DESC`,
      [userId]
    );
    return rows;
  }

  // Obriši prihod prema ID-u
  static async deleteById(id, userId) {
    const [result] = await db.execute(
      'DELETE FROM income WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result;
  }

  // Ažuriraj prihod
  static async update(id, userId, data) {
    const [result] = await db.execute(
      `UPDATE income SET 
        amount = ?, 
        description = ?, 
        date = ?,
        is_recurring = ?,
        recurrence_interval = ?,
        recurrence_end_date = ? 
      WHERE id = ? AND user_id = ?`,
      [
        data.amount,
        data.description,
        data.date,
        data.isRecurring,
        data.recurrenceInterval,
        data.recurrenceEndDate,
        id,
        userId
      ]
    );
    return result;
  }

  // Dohvati mjesečne prihode
  static async getMonthlyIncome(userId, months) {
    const [rows] = await db.execute(
      `SELECT 
        DATE_FORMAT(date, '%Y-%m') as month, 
        SUM(amount) as total 
      FROM income 
      WHERE user_id = ? 
      GROUP BY DATE_FORMAT(date, '%Y-%m') 
      ORDER BY month DESC 
      LIMIT ?`,
      [userId, parseInt(months)]
    );
    return rows;
  }
}

module.exports = Income;
