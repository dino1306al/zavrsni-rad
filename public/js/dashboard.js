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

    if (availableMonths.length > 0) {
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      availableMonths.sort((a, b) => b.localeCompare(a));
      currentMonthIndex = availableMonths.indexOf(currentMonthStr);

      if (currentMonthIndex === -1) {
        currentMonthIndex = 0;
        if (availableMonths.length > 0) {
          const [year, month] = availableMonths[0].split('-');
          currentYear = parseInt(year);
          currentMonth = parseInt(month) - 1;
        }
      }
    }

    await loadData();
    updateNavigationButtons();

  } catch (error) {
    console.error('Detalji greške:', error);
    showAlert(`Greška: ${error.message}`, 'error');
    if (error.message.includes('token') || error.message.includes('401')) {
      localStorage.clear();
      window.location.href = 'index.html';
    }
  }

  window.changeMonth = async function(offset) {
    const newIndex = currentMonthIndex + offset;

    if (newIndex < 0 || newIndex >= availableMonths.length) return;

    currentMonthIndex = newIndex;
    if (availableMonths[currentMonthIndex]) {
      const [year, month] = availableMonths[currentMonthIndex].split('-');
      currentYear = parseInt(year);
      currentMonth = parseInt(month) - 1;
    } else {
      console.error("Pokušaj dohvaćanja nepostojećeg indeksa mjeseca:", newIndex);
      return;
    }

    await loadData();
    updateNavigationButtons();
  };

  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

    if (!prevButton || !nextButton) return;

    if (availableMonths.length <= 1) {
      prevButton.disabled = true;
      nextButton.disabled = true;
    } else {
      prevButton.disabled = currentMonthIndex === 0;
      nextButton.disabled = currentMonthIndex === availableMonths.length - 1;
    }

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
        let errorMsg = 'Greška pri dohvaćanju dostupnih mjeseci';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      availableMonths = await response.json();
    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      showAlert(`Greška u dohvaćanju mjeseci: ${error.message}`, 'error');
      availableMonths = [];
    }
  }

  async function loadData() {
    try {
      updateMonthDisplay();
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const previousMonthStr = getPreviousMonthString();

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
        previousMonthStr ? fetch(`/income/summary?user_id=${localStorage.getItem('userId')}&month=${previousMonthStr}`, {
          headers: getAuthHeader()
        }) : Promise.resolve(new Response(JSON.stringify({ income: 0, expenses: 0, balance: 0 }), { status: 200 })
      ]);

      if (!incomesRes.ok) throw new Error(`Greška pri dohvaćanju prihoda: ${incomesRes.statusText}`);
      if (!expensesRes.ok) throw new Error(`Greška pri dohvaćanju troškova: ${expensesRes.statusText}`);

      let budgets = [];
      if (budgetsRes.ok) {
        budgets = await budgetsRes.json();
      } else {
        console.warn(`Greška pri dohvaćanju budžeta: ${budgetsRes.statusText}`);
      }
      
      previousMonthData = { income: 0, expenses: 0, balance: 0 };
      if (prevMonthRes && prevMonthRes.ok) {
        previousMonthData = await prevMonthRes.json();
      } else {
        console.warn("Nema podataka za prethodni mjesec.");
      }
      
      const incomes = await incomesRes.json();
      const expenses = await expensesRes.json();

      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const balance = totalIncome - totalExpenses;

      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

      const prevBalance = previousMonthData ? previousMonthData.balance : 0;
      const balanceChange = balance - prevBalance;
      const balanceChangeElement = document.getElementById('balanceChange');
      if (balanceChangeElement) {
        if (balanceChange >= 0) {
          balanceChangeElement.innerHTML = `<span style="color: green">↑ ${balanceChange.toFixed(2)} €</span> u odnosu na prethodni mjesec`;
        } else {
          balanceChangeElement.innerHTML = `<span style="color: red">↓ ${Math.abs(balanceChange).toFixed(2)} €</span> u odnosu na prethodni mjesec`;
        }
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
    const prevIndex = currentMonthIndex + 1;
    if (prevIndex < availableMonths.length) {
      return availableMonths[prevIndex];
    }
    return null;
  }

  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", 
                       "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    const displayElement = document.getElementById('currentMonth');
    if (displayElement) {
      displayElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
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
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function createBudgetChart(expenses, budgets) {
    const container = document.getElementById('budgetChart')?.parentElement;
    if (!container) return;
    
    if (budgetChart) {
      budgetChart.destroy();
      budgetChart = null;
    }

    if (!Array.isArray(budgets) || budgets.length === 0) {
      container.innerHTML = `
        <h2>Pregled budžeta</h2>
        <p>Niste postavili budžete za ovaj mjesec. <a href="budgets.html">Postavite budžete</a> za bolju kontrolu troškova.</p>
        <canvas id="budgetChart" style="display: none;"></canvas>
      `;
      return;
    }
    
    if (!container.querySelector('canvas') || container.querySelector('canvas').style.display === 'none') {
      container.innerHTML = `
        <h2>Pregled budžeta</h2>
        <canvas id="budgetChart"></canvas>
      `;
    }
    
    const ctx = document.getElementById('budgetChart').getContext('2d');

    const expensesByCategory = {};
    expenses.forEach(exp => {
      if (!exp.category) return;
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + parseFloat(exp.amount || 0);
    });

    const categories = budgets.map(b => b.category);
    const budgetAmounts = budgets.map(b => parseFloat(b.amount || 0));
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

    budgetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Zadani budžet',
          data: budgetAmounts,
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        }, {
          label: 'Stvarni troškovi',
          data: actualAmounts,
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
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

  function createCategoriesChart(expenses) {
    const container = document.getElementById('categoriesChart')?.parentElement;
    if (!container) return;

    if (categoriesChart) {
      categoriesChart.destroy();
      categoriesChart = null;
    }
    
    if (!Array.isArray(expenses) || expenses.length === 0) {
      container.innerHTML = `
        <h2>Troškovi po kategorijama</h2>
        <p>Nema troškova za prikaz u ovom mjesecu.</p>
        <canvas id="categoriesChart" style="display: none;"></canvas>
      `;
      return;
    }

    if (!container.querySelector('canvas') || container.querySelector('canvas').style.display === 'none') {
      container.innerHTML = `
        <h2>Troškovi po kategorijama</h2>
        <canvas id="categoriesChart"></canvas>
      `;
    }
    
    const ctx = document.getElementById('categoriesChart').getContext('2d');

    const categories = {};
    expenses.forEach(exp => {
      if (!exp.category) return;
      categories[exp.category] = (categories[exp.category] || 0) + parseFloat(exp.amount || 0);
    });

    const labels = Object.keys(categories);
    const amounts = Object.values(categories);

    const backgroundColors = labels.length <= 10
      ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#E7E9ED', '#8DDF3C', '#F67019']
      : labels.map((_, index) => `hsl(${(index * 36)}deg, 70%, 60%)`);

    categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: amounts,
          backgroundColor: backgroundColors,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
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
        const errorText = await response.text().catch(() => "Nepoznata greška servera");
        console.error("Server vratio grešku za usporedbu:", response.status, errorText);
        throw new Error('Greška pri dohvaćanju podataka za usporedbu');
      }

      let comparisonData = await response.json();

      if (!Array.isArray(comparisonData) || comparisonData.length === 0) {
        showAlert("Nema dovoljno podataka za mjesečnu usporedbu.", "info");
        return;
      }
      
      comparisonData.sort((a,b) => a.month.localeCompare(b.month));

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

      const modalElement = document.getElementById('comparisonModal');
      const canvasElement = document.getElementById('comparisonChart');
      if (!modalElement || !canvasElement) return;
      const ctx = canvasElement.getContext('2d');

      if (comparisonChart) {
        comparisonChart.destroy();
      }

      comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Prihodi',
            data: incomeData,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }, {
            label: 'Troškovi',
            data: expensesData,
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }]
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

      modalElement.style.display = 'block';
    } catch (error) {
      console.error('Greška u showMonthlyComparison:', error);
      showAlert(`Greška pri učitavanju usporedbe: ${error.message}`, 'error');
    }
  };

  window.hideComparisonModal = function() {
    const modalElement = document.getElementById('comparisonModal');
    if (modalElement) {
      modalElement.style.display = 'none';
    }
  };
  
  function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
  
  function getAuthHeader() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
  }
  
  function showAlert(message, type='error') {
    let alertBox = document.querySelector('.alert-box');
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.className = 'alert-box';
      document.body.appendChild(alertBox);
    }
    
    alertBox.className = `alert-box alert-${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';

    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 5000);
  }
});
