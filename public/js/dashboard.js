document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  
  let financeChart = null;
  let budgetChart = null;
  let categoriesChart = null;
  let comparisonChart = null;
  
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  let previousMonthData = { income: 0, expenses: 0, balance: 0 };
  let availableMonths = [];
  let currentMonthIndex = 0;

  try {
    document.getElementById('welcomeMessage').textContent = `Dobrodošli, ${localStorage.getItem('username')}!`;
    await loadAvailableMonths();
    
    // Postavi na najnoviji mjesec ako već nismo na nekom od dostupnih mjeseci
    if (availableMonths.length > 0) {
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      currentMonthIndex = availableMonths.indexOf(currentMonthStr);
      
      if (currentMonthIndex === -1) {
        currentMonthIndex = 0;
        const [year, month] = availableMonths[0].split('-');
        currentYear = parseInt(year);
        currentMonth = parseInt(month) - 1;
      }
    }
    
    await loadData();
    updateNavigationButtons();
  } catch (error) {
    console.error('Detalji greške:', error);
    showAlert(`Greška: ${error.message}`, 'error');
    if (error.message.includes('token') || error.message.includes('401')) {
      localStorage.clear();
      window.location.href = 'login.html';
    }
  }

  window.changeMonth = function(offset) {
    const newIndex = currentMonthIndex + offset;
    
    // Provjeri granice
    if (newIndex < 0 || newIndex >= availableMonths.length) return;
    
    currentMonthIndex = newIndex;
    const [year, month] = availableMonths[currentMonthIndex].split('-');
    currentYear = parseInt(year);
    currentMonth = parseInt(month) - 1;
    
    loadData();
    updateNavigationButtons();
  };

  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');
    
    // Onemogući gumbe ako nema dostupnih mjeseci
    if (availableMonths.length === 0) {
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }
    
    // Onemogući "Prethodni" ako smo na prvom mjesecu
    prevButton.disabled = currentMonthIndex === 0;
    
    // Onemogući "Sljedeći" ako smo na zadnjem mjesecu
    nextButton.disabled = currentMonthIndex === availableMonths.length - 1;
    
    // Stilovi za onemogućene gumbe
    prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
    prevButton.style.cursor = prevButton.disabled ? 'not-allowed' : 'pointer';
    nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
    nextButton.style.cursor = nextButton.disabled ? 'not-allowed' : 'pointer';
  }

  async function loadAvailableMonths() {
    try {
      const response = await fetch(`http://localhost:3000/income/transactions/months?user_id=${localStorage.getItem('userId')}`, {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error('Greška pri dohvaćanju dostupnih mjeseci');
      }
      
      availableMonths = await response.json();
      
      // Sortira mjesece od najnovijeg prema najstarijem
      availableMonths.sort((a, b) => a.localeCompare(b));

      // <---- NOVO DODANO ---->
      console.log("Dostupni mjeseci:", availableMonths);
      // <---------------------->

    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      throw error;
    }
  }

  async function loadData() {
    try {
      updateMonthDisplay();
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      const [incomesRes, expensesRes, budgetsRes, prevMonthRes] = await Promise.all([
        fetch(`http://localhost:3000/income?user_id=${localStorage.getItem('userId')}&month=${monthString}`, {
          headers: getAuthHeader()
        }),
        fetch(`http://localhost:3000/expenses?user_id=${localStorage.getItem('userId')}&month=${monthString}`, {
          headers: getAuthHeader()
        }),
        fetch(`http://localhost:3000/budgets?user_id=${localStorage.getItem('userId')}&month=${monthString}`, {
          headers: getAuthHeader()
        }),
        fetch(`http://localhost:3000/income/summary?user_id=${localStorage.getItem('userId')}&month=${getPreviousMonthString()}`, {
          headers: getAuthHeader()
        })
      ]);

      if (!incomesRes.ok) {
        throw new Error(`Income API error: ${incomesRes.status} ${await incomesRes.text()}`);
      }
      if (!expensesRes.ok) {
        throw new Error(`Expenses API error: ${expensesRes.status} ${await expensesRes.text()}`);
      }
      if (!budgetsRes.ok) {
        throw new Error(`Budgets API error: ${budgetsRes.status} ${await budgetsRes.text()}`);
      }
      
      let previousMonthData = { income: 0, expenses: 0, balance: 0 };
      if (prevMonthRes.ok) {
        previousMonthData = await prevMonthRes.json();
      }

      const incomes = await incomesRes.json();
      const expenses = await expensesRes.json();
      const budgets = await budgetsRes.json();

      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const balance = totalIncome - totalExpenses;
      
      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';
      
      const balanceChange = balance - previousMonthData.balance;
      const balanceChangeElement = document.getElementById('balanceChange');
      balanceChangeElement.innerHTML = balanceChange > 0 ? 
        `<span style="color: green">↑ ${balanceChange.toFixed(2)} €</span>` :
        `<span style="color: red">↓ ${Math.abs(balanceChange).toFixed(2)} €</span>`;
      
      createFinanceChart(totalIncome, totalExpenses, balance);
      createBudgetChart(expenses, budgets);
      await loadCategoriesChart(expenses);
      
    } catch (error) {
      console.error('Greška u loadData:', error);
      showAlert(`Greška pri učitavanju podataka: ${error.message}`, 'error');
    }
  }

  function getPreviousMonthString() {
    if (currentMonthIndex < availableMonths.length - 1) {
      return availableMonths[currentMonthIndex + 1];
    }
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }

  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
                       "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
  }

  function createFinanceChart(totalIncome, totalExpenses, balance) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    if (financeChart) {
      financeChart.destroy();
    }
    
    financeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Prihodi', 'Troškovi', 'Saldo'],
        datasets: [{
          label: 'Financijski pregled',
          data: [totalIncome, totalExpenses, balance],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function createBudgetChart(expenses, budgets) {
    const ctx = document.getElementById('budgetChart').getContext('2d');
    
    if (budgetChart) {
      budgetChart.destroy();
    }
    
    if (budgets.length === 0) {
      document.getElementById('budgetChart').parentElement.innerHTML = `
        <h2>Pregled budžeta</h2>
        <p>Niste postavili budžete. <a href="budgets.html">Postavite budžete</a> za bolju kontrolu troškova.</p>
      `;
      return;
    }

    const expensesByCategory = {};
    expenses.forEach(exp => {
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += parseFloat(exp.amount);
    });

    const categories = budgets.map(b => b.category);
    const budgetAmounts = budgets.map(b => b.amount);
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

    budgetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Budžet',
            data: budgetAmounts,
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          },
          {
            label: 'Stvarni troškovi',
            data: actualAmounts,
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  async function loadCategoriesChart(expenses) {
    const ctx = document.getElementById('categoriesChart').getContext('2d');
    
    if (categoriesChart) {
      categoriesChart.destroy();
    }
    
    const categories = {};
    expenses.forEach(exp => {
      if (!categories[exp.category]) {
        categories[exp.category] = 0;
      }
      categories[exp.category] += parseFloat(exp.amount);
    });
    
    const labels = Object.keys(categories);
    const amounts = Object.values(categories);
    
    categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: amounts,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  }

  window.showMonthlyComparison = async function() {
    try {
      const response = await fetch(`http://localhost:3000/income/transactions/comparison?user_id=${localStorage.getItem('userId')}`, {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error('Greška pri dohvaćanju podataka za usporedbu');
      }
      
      const comparisonData = await response.json();
      
      const labels = comparisonData.map(item => {
        const [year, month] = item.month.split('-');
        const monthNames = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      });
      
      const incomeData = comparisonData.map(item => item.income || 0);
      const expensesData = comparisonData.map(item => item.expenses || 0);
      
      const ctx = document.getElementById('comparisonChart').getContext('2d');
      
      if (comparisonChart) {
        comparisonChart.destroy();
      }
      
      comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Prihodi',
              data: incomeData,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            },
            {
              label: 'Troškovi',
              data: expensesData,
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            title: {
              display: true,
              text: 'Mjesečna usporedba prihoda i troškova'
            }
          }
        }
      });
      
      document.getElementById('comparisonModal').style.display = 'block';
    } catch (error) {
      console.error('Greška u showMonthlyComparison:', error);
      showAlert(`Greška pri učitavanju usporedbe: ${error.message}`, 'error');
    }
  };

  window.hideComparisonModal = function() {
    document.getElementById('comparisonModal').style.display = 'none';
  };

  function showAlert(message, type) {
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);
    setTimeout(() => {
      alertBox.remove();
    }, 5000);
  }
});
