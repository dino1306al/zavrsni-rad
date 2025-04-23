const express = require('express');
const router = express.Router();
const Expense = require('../models/expenses');
const { authenticate } = require('./users');

// Dohvati sve troškove korisnika
router.get('/', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    let expenses;
    
    if (month) {
      expenses = await Expense.findByUserIdAndMonth(req.user.id, month);
    } else {
      expenses = await Expense.findByUserId(req.user.id);
    }
    
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Dohvati ponavljajuće troškove
router.get('/recurring', authenticate, async (req, res) => {
  try {
    const expenses = await Expense.getRecurringExpenses(req.user.id);
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Dohvati mjesečne troškove
router.get('/monthly', authenticate, async (req, res) => {
  try {
    const { months = 3 } = req.query;
    const monthlyExpenses = await Expense.getMonthlyExpenses(req.user.id, months);
    res.json(monthlyExpenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Dohvati troškove po kategorijama
router.get('/by-category', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month) {
      return res.status(400).json({ error: 'Mjesec je obavezan' });
    }
    
    const expensesByCategory = await Expense.getTotalByCategory(req.user.id, month);
    res.json(expensesByCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Dodaj novi trošak
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, description, date, category, isRecurring, recurrenceInterval, recurrenceEndDate } = req.body;
    
    if (!amount || !date || !category) {
      return res.status(400).json({ error: 'Iznos, datum i kategorija su obavezni' });
    }
    
    await Expense.create(
      req.user.id, 
      amount, 
      description, 
      date, 
      category, 
      isRecurring, 
      recurrenceInterval, 
      recurrenceEndDate
    );
    res.json({ message: 'Trošak uspješno dodan!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Obriši trošak
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await Expense.deleteById(id, req.user.id);
    res.json({ message: 'Trošak obrisan!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Ažuriraj trošak
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, category, isRecurring, recurrenceInterval, recurrenceEndDate } = req.body;
    
    await Expense.update(id, req.user.id, {
      amount,
      description,
      date,
      category,
      isRecurring,
      recurrenceInterval,
      recurrenceEndDate
    });
    res.json({ message: 'Trošak ažuriran!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

module.exports = router;