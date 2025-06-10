const express = require('express');
const router = express.Router();
const Budget = require('../models/budget');
const { authenticate } = require('./users');

// Dohvati budžete za korisnika, s opcionalnim filtriranjem po mjesecu
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query; // Dohvaćamo 'month' iz query parametara (npr. '2025-04')

    let budgets;

    // *** ISPRAVAK START ***
    // Ako je 'month' parametar poslan, filtriramo rezultate po mjesecu.
    // Ako nije, vraćamo sve budžete kao i prije.
    if (month) {
      // Koristimo postojeću funkciju 'getByMonth' iz modela koja ispravno filtrira bazu
      budgets = await Budget.getByMonth(userId, month);
    } else {
      // Staro ponašanje, ako zatreba negdje drugdje
      budgets = await Budget.findByUserId(userId);
    }
    // *** ISPRAVAK END ***

    res.json(budgets);
  } catch (err) {
    console.error('Greška pri dohvaćanju budžeta:', err);
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
    res.status(201).json({ message: 'Budžet uspješno dodan!' }); // Koristimo 201 Created status
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Ažuriraj budžet
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) {
        return res.status(400).json({ error: 'Iznos je obavezan' });
    }
    const result = await Budget.update(req.params.id, req.user.id, amount);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Budžet nije pronađen ili nemate dozvolu za izmjenu.' });
    }
    res.json({ message: 'Budžet ažuriran!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Obriši budžet
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await Budget.deleteById(req.params.id, req.user.id);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Budžet nije pronađen ili nemate dozvolu za brisanje.' });
    }
    res.json({ message: 'Budžet obrisan!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

module.exports = router;
