const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user');

const SECRET = process.env.JWT_SECRET || 'tajna_lozinka';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Middleware za autentifikaciju
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Niste prijavljeni' });
    }

    const decoded = await jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token je istekao' });
    }
    return res.status(403).json({ error: 'Nevažeći token' });
  }
};

// Registracija korisnika
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Sva polja su obavezna' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Lozinka mora imati najmanje 6 znakova' });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Korisničko ime je zauzeto' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create(username, hashedPassword);

    res.status(201).json({ message: 'Korisnik uspješno registriran' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Prijava korisnika
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Neispravni podaci za prijavu' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Neispravni podaci za prijavu' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      SECRET,
      { expiresIn: EXPIRES_IN }
    );

    res.json({
      message: 'Uspješna prijava',
      token,
      userId: user.id,
      username: user.username,
      expiresIn: EXPIRES_IN
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Dohvat korisničkog profila
router.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = { router, authenticate };