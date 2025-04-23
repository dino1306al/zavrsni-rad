const express = require('express');
const router = express.Router();
const Budget = require('../models/budget');
const { authenticate } = require('./users');

// Dohvati sve budžete za korisnika
router.get('/', authenticate, async (req, res) => {
  try {
    const budgets = await Budget.findByUserId(req.user.id);
    res.json(budgets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Dodaj novi budžet
router.post('/', authenticate, async (req, res) => {
  try {
    const { category, amount, month } = req.body;
    
    if (!category || !amount || !month) {
      return res.status(400).json({ error: 'Sva polja su obavezna' });
    }

    await Budget.create(req.user.id, category, amount, month);
    res.json({ message: 'Budžet uspješno dodan!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Ažuriraj budžet
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    await Budget.update(req.params.id, req.user.id, amount);
    res.json({ message: 'Budžet ažuriran!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Obriši budžet
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Budget.deleteById(req.params.id, req.user.id);
    res.json({ message: 'Budžet obrisan!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

module.exports = router;