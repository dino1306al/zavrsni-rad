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

  // Bazni URL za API pozive
  const API_BASE_URL = ''; // Ostavljamo prazno za relativne putanje

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
      const response = await fetch(`/income/transactions/months?user_id=${localStorage.getItem('userId')}`, {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error('Greška pri dohvaćanju dostupnih mjeseci');
      }
      
      availableMonths = await response.json();
      
      // Sortira mjesece od najnovijeg prema najstarijem
      availableMonths.sort((a, b) => b.localeCompare(a));

      console.log("Dostupni mjeseci:", availableMonths);

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
        fetch(`/income?user_id=${localStorage.getItem('userId')}&month=${monthString}`, {
          headers: getAuthHeader()
        }),
        fetch(`/expenses?user_id=${localStorage.getItem('userId')}&month=${monthString}`, {
          headers: getAuthHeader()
        }),
        fetch(`/budgets?user_id=${localStorage.getItem('userId')}&month=${monthString}`, {
          headers: getAuthHeader()
        }),
        fetch(`/income/summary?user_id=${localStorage.getItem('userId')}&month=${getPreviousMonthString()}`, {
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

      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const balance = totalIncome - totalExpenses;
      
      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';
      
      const balanceChange = balance - (previousMonthData.balance || 0);
      const balanceChangeElement = document.getElementById('balanceChange');
      if (balanceChangeElement) {
        balanceChangeElement.innerHTML = balanceChange > 0 ? 
          `<span style="color: green">↑ ${balanceChange.toFixed(2)} €</span>` :
          `<span style="color: red">↓ ${Math.abs(balanceChange).toFixed(2)} €</span>`;
      }
      
      createFinanceChart(totalIncome, totalExpenses, balance);
      createBudgetChart(expenses, budgets);
      createCategoriesChart(expenses);
      
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
    const ctx = document.getElementById('financeChart')?.getContext('2d');
    if (!ctx) return;
    
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
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('hr-HR', { 
                    style: 'currency', 
                    currency: 'EUR' 
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        }
      }
    });
  }

  function createBudgetChart(expenses, budgets) {
    const ctx = document.getElementById('budgetChart')?.getContext('2d');
    if (!ctx) return;
    
    if (budgetChart) {
      budgetChart.destroy();
    }
    
    if (!Array.isArray(budgets) || budgets.length === 0) {
      const container = document.getElementById('budgetChart').parentElement;
      if (container) {
        container.innerHTML = `
          <h2>Pregled budžeta</h2>
          <p>Niste postavili budžete. <a href="budgets.html">Postavite budžete</a> za bolju kontrolu troškova.</p>
        `;
      }
      return;
    }

    const expensesByCategory = {};
    expenses.forEach(exp => {
      if (!exp.category) return;
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += parseFloat(exp.amount || 0);
    });

    const categories = budgets.map(b => b.category);
    const budgetAmounts = budgets.map(b => parseFloat(b.amount || 0));
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

    budgetChart = new Chart(ctx, {
      type: 'bar',
      indexAxis: 'y',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Budžet',
            data: budgetAmounts,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'Stvarni troškovi',
            data: actualAmounts,
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.x !== null) {
                  label += new Intl.NumberFormat('hr-HR', { 
                    style: 'currency', 
                    currency: 'EUR' 
                  }).format(context.parsed.x);
                }
                return label;
              }
            }
          }
        }
      }
    });
  }

  function createCategoriesChart(expenses) {
    const ctx = document.getElementById('categoriesChart')?.getContext('2d');
    if (!ctx) return;
    
    if (categoriesChart) {
      categoriesChart.destroy();
    }
    
    if (!Array.isArray(expenses) || expenses.length === 0) {
      const container = document.getElementById('categoriesChart').parentElement;
      if (container) {
        container.innerHTML = `
          <h2>Troškovi po kategorijama</h2>
          <p>Nema troškova za prikaz.</p>
        `;
      }
      return;
    }

    const categories = {};
    expenses.forEach(exp => {
      if (!exp.category) return;
      if (!categories[exp.category]) {
        categories[exp.category] = 0;
      }
      categories[exp.category] += parseFloat(exp.amount || 0);
    });
    
    const labels = Object.keys(categories);
    const amounts = Object.values(categories);
    
    if (labels.length === 0) {
      const container = document.getElementById('categoriesChart').parentElement;
      if (container) {
        container.innerHTML = `
          <h2>Troškovi po kategorijama</h2>
          <p>Nema troškova s kategorijama za prikaz.</p>
        `;
      }
      return;
    }

    const backgroundColors = labels.length <= 6
      ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
      : labels.map((_, index) => `hsl(${(index * 45) % 360}, 70%, 60%)`);

    categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Troškovi',
          data: amounts,
          backgroundColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                let value = context.parsed || 0;
                let sum = context.dataset.data.reduce((a, b) => a + b, 0);
                let percentage = sum > 0 ? ((value / sum) * 100).toFixed(1) + '%' : '0%';

                if (label) label += ': ';
                label += new Intl.NumberFormat('hr-HR', { 
                  style: 'currency', 
                  currency: 'EUR' 
                }).format(value);
                label += ` (${percentage})`;
                return label;
              }
            }
          }
        }
      }
    });
  }

  window.showMonthlyComparison = async function() {
    try {
      const response = await fetch(`/income/transactions/comparison?user_id=${localStorage.getItem('userId')}`, {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error('Greška pri dohvaćanju podataka za usporedbu');
      }
      
      const comparisonData = await response.json();
      
      if (!Array.isArray(comparisonData) || comparisonData.length === 0) {
        showAlert("Nema podataka za usporedbu.", "info");
        return;
      }
      
      const labels = comparisonData.map(item => {
        if (typeof item.month !== 'string' || !item.month.includes('-')) return 'N/A';
        const [year, month] = item.month.split('-');
        const monthNames = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];
        const monthIndex = parseInt(month) - 1;
        if (monthIndex >= 0 && monthIndex < 12 && year && year.length === 4) {
          return `${monthNames[monthIndex]} '${year.substring(2)}`;
        }
        return item.month;
      });
      
      const incomeData = comparisonData.map(item => item.income || 0);
      const expensesData = comparisonData.map(item => item.expenses || 0);
      
      const ctx = document.getElementById('comparisonChart')?.getContext('2d');
      if (!ctx) return;
      
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
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            title: {
              display: true,
              text: 'Mjesečna usporedba prihoda i troškova'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) label += ': ';
                  if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('hr-HR', { 
                      style: 'currency', 
                      currency: 'EUR' 
                    }).format(context.parsed.y);
                  }
                  return label;
                }
              }
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

  function showAlert(message, type = 'error') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = 'float:right; background:none; border:none; font-size:1.2em; line-height:1; cursor:pointer; margin-left: 15px; padding: 0;';
    closeButton.onclick = () => alertBox.remove();
    alertBox.appendChild(closeButton);
    
    document.body.appendChild(alertBox);
    setTimeout(() => {
      if (alertBox.parentNode) {
        alertBox.remove();
      }
    }, 5000);
  }
});