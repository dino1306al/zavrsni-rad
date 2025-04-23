const express = require('express');
const router = express.Router();
const Income = require('../models/income');
const Expense = require('../models/expenses');  // Assuming you have an expense model
const { authenticate } = require('./users');
const db = require('../db');  // Assuming you're using a database connection like MySQL or PostgreSQL

// Fetch all incomes for the user
router.get('/', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    let incomes;
    
    if (month) {
      incomes = await Income.findByUserIdAndMonth(req.user.id, month);
    } else {
      incomes = await Income.findByUserId(req.user.id);
    }
    
    res.json(incomes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch recurring incomes
router.get('/recurring', authenticate, async (req, res) => {
  try {
    const incomes = await Income.getRecurringIncome(req.user.id);
    res.json(incomes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new income
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, description, date, isRecurring, recurrenceInterval, recurrenceEndDate } = req.body;
    
    if (!amount || !date) {
      return res.status(400).json({ error: 'Amount and date are required' });
    }
    
    await Income.create(
      req.user.id, 
      amount, 
      description, 
      date, 
      isRecurring, 
      recurrenceInterval, 
      recurrenceEndDate
    );
    res.status(201).json({ message: 'Income added successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an income
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await Income.deleteById(id, req.user.id);
    res.json({ message: 'Income deleted!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update an income
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, isRecurring, recurrenceInterval, recurrenceEndDate } = req.body;
    
    await Income.update(id, req.user.id, {
      amount,
      description,
      date,
      isRecurring,
      recurrenceInterval,
      recurrenceEndDate
    });
    res.json({ message: 'Income updated!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch monthly income
router.get('/monthly', authenticate, async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const monthlyIncome = await Income.getMonthlyIncome(req.user.id, months);
    res.json(monthlyIncome);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch monthly summary of income and expenses
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month) {
      return res.status(400).json({ error: 'Month is required' });
    }
    
    // Fetch income for the given month
    const incomes = await Income.findByUserIdAndMonth(req.user.id, month);
    
    // Fetch expenses for the given month
    const expenses = await Expense.findByUserIdAndMonth(req.user.id, month);
    
    // Calculate total income
    const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    
    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    // Calculate balance
    const balance = totalIncome - totalExpenses;
    
    // Return the results
    res.json({
      income: totalIncome,
      expenses: totalExpenses,
      balance: balance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// New route to fetch all months with transactions
router.get('/transactions/months', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const [incomeMonths, expenseMonths] = await Promise.all([
      db.execute(
        `SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') as month 
         FROM income WHERE user_id = ? 
         ORDER BY month DESC`,
        [user_id]
      ),
      db.execute(
        `SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') as month 
         FROM expenses WHERE user_id = ? 
         ORDER BY month DESC`,
        [user_id]
      )
    ]);

    // Combine and remove duplicates
    const months = new Set([
      ...incomeMonths[0].map(item => item.month),
      ...expenseMonths[0].map(item => item.month)
    ]);

    res.json(Array.from(months).sort().reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch data for monthly comparison
router.get('/transactions/comparison', authenticate, async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const [monthlyIncome, monthlyExpenses] = await Promise.all([
      db.execute(
        `SELECT 
          DATE_FORMAT(date, '%Y-%m') as month, 
          SUM(amount) as total 
         FROM income 
         WHERE user_id = ? 
         GROUP BY DATE_FORMAT(date, '%Y-%m') 
         ORDER BY month`,
        [user_id]
      ),
      db.execute(
        `SELECT 
          DATE_FORMAT(date, '%Y-%m') as month, 
          SUM(amount) as total 
         FROM expenses 
         WHERE user_id = ? 
         GROUP BY DATE_FORMAT(date, '%Y-%m') 
         ORDER BY month`,
        [user_id]
      )
    ]);

    // Combine the data
    const comparisonData = {};
    
    monthlyIncome[0].forEach(item => {
      comparisonData[item.month] = {
        ...comparisonData[item.month],
        income: parseFloat(item.total)
      };
    });
    
    monthlyExpenses[0].forEach(item => {
      comparisonData[item.month] = {
        ...comparisonData[item.month],
        expenses: parseFloat(item.total)
      };
    });

    // Transform to an array of objects
    const result = Object.keys(comparisonData).map(month => ({
      month,
      income: comparisonData[month].income || 0,
      expenses: comparisonData[month].expenses || 0
    })).sort((a, b) => a.month.localeCompare(b.month));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
