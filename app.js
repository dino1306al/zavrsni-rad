const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const { authenticate } = require('./routes/users');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cors());

// Rute
const userRoutes = require('./routes/users').router;
const incomeRoutes = require('./routes/income');
const expensesRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budgets');

app.use('/users', userRoutes);
app.use('/income', authenticate, incomeRoutes);
app.use('/expenses', authenticate, expensesRoutes);
app.use('/budgets', authenticate, budgetRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Došlo je do greške na serveru' });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server pokrenut na portu ${PORT}`);
});