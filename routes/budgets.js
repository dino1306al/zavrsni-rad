const express = require('express');
const router = express.Router();
const Budget = require('../models/budget');
const { authenticate } = require('./users');

// Dohvati budžete za korisnika, s opcionalnim filtriranjem po mjesecu
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query; 

    let budgets;
    if (month) {
      budgets = await Budget.getByMonth(userId, month);
    } else {
      budgets = await Budget.findByUserId(userId);
    }
    res.json(budgets);
  } catch (err) {
    console.error('Greška pri dohvaćanju budžeta:', err);
    res.status(500).json({ message: 'Greška na serveru' });
  }
});

// *** AŽURIRANA RUTA ZA DODAVANJE NOVOG BUDŽETA ***
router.post('/', authenticate, async (req, res) => {
  try {
    const { category, amount, month } = req.body;
    
    // Provjera jesu li sva polja prisutna
    if (!category || !amount || !month) {
      return res.status(400).json({ message: 'Sva polja su obavezna: kategorija, iznos i mjesec.' });
    }

    // 1. PROVJERA POSTOJI LI VEĆ BUDŽET
    // Koristimo novu funkciju iz modela
    const existingBudget = await Budget.findByCategoryAndMonth(req.user.id, category, month);

    if (existingBudget) {
      // Ako budžet postoji, vraćamo grešku 409 Conflict s jasnom porukom
      return res.status(409).json({ 
        message: `Budžet za kategoriju "${category}" već postoji za odabrani mjesec. Možete ga urediti na postojećoj listi.` 
      });
    }

    // 2. AKO NE POSTOJI, KREIRAMO NOVI
    await Budget.create(req.user.id, category, amount, month);
    res.status(201).json({ message: 'Budžet uspješno dodan!' });

  } catch (err) {
    console.error('Greška kod kreiranja budžeta:', err);
    res.status(500).json({ message: 'Došlo je do greške na serveru prilikom dodavanja budžeta.' });
  }
});
// *** KRAJ AŽURIRANE RUTE ***

// Ažuriraj budžet
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) {
        return res.status(400).json({ message: 'Iznos je obavezan' });
    }
    const result = await Budget.update(req.params.id, req.user.id, amount);
    if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Budžet nije pronađen ili nemate dozvolu za izmjenu.' });
    }
    res.json({ message: 'Budžet ažuriran!' });
  } catch (err) {
    console.error('Greška kod ažuriranja budžeta:', err);
    res.status(500).json({ message: 'Greška na serveru' });
  }
});

// Obriši budžet
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await Budget.deleteById(req.params.id, req.user.id);
    if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Budžet nije pronađen ili nemate dozvolu za brisanje.' });
    }
    res.json({ message: 'Budžet obrisan!' });
  } catch (err) {
    console.error('Greška kod brisanja budžeta:', err);
    res.status(500).json({ message: 'Greška na serveru' });
  }
});

module.exports = router;
