document.addEventListener('DOMContentLoaded', async () => {
  // Provjera je li korisnik prijavljen
  if (!checkAuth()) return;

  // Varijable za Chart.js instance kako bi se mogle uništiti prije ponovnog crtanja
  let financeChart = null;
  let budgetChart = null;
  let categoriesChart = null;
  let comparisonChart = null;

  // Globalne varijable za praćenje stanja
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  let previousMonthData = { income: 0, expenses: 0, balance: 0 };
  let availableMonths = [];
  let currentMonthIndex = 0;

  try {
    // Inicijalizacija stranice
    document.getElementById('welcomeMessage').textContent = `Dobrodošli, ${localStorage.getItem('username')}!`;
    await loadAvailableMonths();

    // Ako postoje dostupni mjeseci s transakcijama
    if (availableMonths.length > 0) {
      // Postavi prikaz na najnoviji dostupni mjesec (zadnji u kronološki sortiranom nizu)
      currentMonthIndex = availableMonths.length - 1;
      
      const [year, month] = availableMonths[currentMonthIndex].split('-');
      currentYear = parseInt(year);
      currentMonth = parseInt(month) - 1;
    }

    // Učitaj podatke za inicijalno odabrani mjesec i ažuriraj gumbe
    await loadData();
    updateNavigationButtons();

  } catch (error) {
    console.error('Greška pri inicijalizaciji nadzorne ploče:', error);
    showAlert(`Greška: ${error.message}`, 'error');
    // Ako je greška vezana za autorizaciju, odjavi korisnika
    if (error.message.includes('token') || error.message.includes('401')) {
      localStorage.clear();
      window.location.href = 'index.html';
    }
  }

  // Funkcija za promjenu mjeseca (povezana s gumbima)
  window.changeMonth = async function(offset) {
    const newIndex = currentMonthIndex + offset;

    // Spriječi odlazak izvan granica dostupnih mjeseci
    if (newIndex < 0 || newIndex >= availableMonths.length) return;

    // Ažuriraj trenutni indeks i datum
    currentMonthIndex = newIndex;
    const [year, month] = availableMonths[currentMonthIndex].split('-');
    currentYear = parseInt(year);
    currentMonth = parseInt(month) - 1;

    // Ponovno učitaj podatke za novi mjesec
    await loadData();
    updateNavigationButtons();
  };

  // Onemogućuje/omogućuje gumbe za navigaciju
  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

    if (!prevButton || !nextButton) return;

    // Onemogući "Prethodni" ako smo na najstarijem mjesecu
    prevButton.disabled = currentMonthIndex === 0;
    // Onemogući "Sljedeći" ako smo na najnovijem mjesecu
    nextButton.disabled = currentMonthIndex === availableMonths.length - 1;

    // Vizualni stil za onemogućene gumbe
    prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
    prevButton.style.cursor = prevButton.disabled ? 'not-allowed' : 'pointer';
    nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
    nextButton.style.cursor = nextButton.disabled ? 'not-allowed' : 'pointer';
  }

  // Dohvaća sve mjesece za koje postoje transakcije
  async function loadAvailableMonths() {
    try {
      const response = await fetch(`/income/transactions/months?user_id=${localStorage.getItem('userId')}`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error('Greška pri dohvaćanju dostupnih mjeseci');
      
      availableMonths = await response.json();
      // Sortiraj mjesece kronološki, npr. ['2025-03', '2025-04', '2025-05']
      availableMonths.sort((a, b) => a.localeCompare(b));
      
    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      showAlert(error.message, 'error');
      availableMonths = [];
    }
  }

  // Glavna funkcija za dohvaćanje i prikaz podataka
  async function loadData() {
    try {
      updateMonthDisplay();
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const comparisonMonthStr = getComparisonMonthString();

      // Paralelno dohvaćanje svih potrebnih podataka
      const [incomesRes, expensesRes, budgetsRes, prevMonthRes] = await Promise.all([
        fetch(`/income?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { headers: getAuthHeader() }),
        fetch(`/expenses?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { headers: getAuthHeader() }),
        fetch(`/budgets?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { headers: getAuthHeader() }),
        comparisonMonthStr ? fetch(`/income/summary?user_id=${localStorage.getItem('userId')}&month=${comparisonMonthStr}`, { headers: getAuthHeader() }) : Promise.resolve(null)
      ]);

      // Provjera odgovora sa servera
      if (!incomesRes.ok) throw new Error(`Greška pri dohvaćanju prihoda: ${incomesRes.statusText}`);
      if (!expensesRes.ok) throw new Error(`Greška pri dohvaćanju troškova: ${expensesRes.statusText}`);

      const incomes = await incomesRes.json();
      const expenses = await expensesRes.json();
      
      let budgets = [];
      if (budgetsRes.ok) budgets = await budgetsRes.json();
      else console.warn(`Greška pri dohvaćanju budžeta: ${budgetsRes.statusText}`);
      
      previousMonthData = { income: 0, expenses: 0, balance: 0 };
      if (prevMonthRes && prevMonthRes.ok) {
        previousMonthData = await prevMonthRes.json();
      } else if (comparisonMonthStr) {
         console.warn("Nema podataka za prethodni mjesec za usporedbu.");
      }
      
      // Izračun sažetka
      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const balance = totalIncome - totalExpenses;

      // Prikaz sažetka na karticama
      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

      const prevBalance = previousMonthData.balance || 0;
      const balanceChange = balance - prevBalance;
      const balanceChangeElement = document.getElementById('balanceChange');
      
      if (balanceChangeElement && comparisonMonthStr) {
        if (balanceChange >= 0) {
            balanceChangeElement.innerHTML = `<span style="color: green">↑ ${balanceChange.toFixed(2)} €</span> u odnosu na prethodni mjesec`;
        } else {
            balanceChangeElement.innerHTML = `<span style="color: red">↓ ${Math.abs(balanceChange).toFixed(2)} €</span> u odnosu na prethodni mjesec`;
        }
      } else if (balanceChangeElement) {
        balanceChangeElement.innerHTML = 'Nema podataka za usporedbu.';
      }

      // Crtanje svih grafova
      createFinanceChart(totalIncome, totalExpenses, balance);
      createBudgetChart(expenses, budgets);
      createCategoriesChart(expenses);

    } catch (error) {
      console.error('Greška u loadData:', error);
      showAlert(`Greška pri učitavanju podataka: ${error.message}`, 'error');
    }
  }

  // Pomoćna funkcija za dohvaćanje stringa prethodnog mjeseca
  function getComparisonMonthString() {
    if (currentMonthIndex > 0) {
        return availableMonths[currentMonthIndex - 1];
    }
    return null; 
  }

  // Ažurira prikaz naziva mjeseca i godine
  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
  }

  // --- FUNKCIJE ZA CRTANJE GRAFOVA ---

  function createFinanceChart(totalIncome, totalExpenses, balance) {
    const ctx = document.getElementById('financeChart')?.getContext('2d');
    if (!ctx) return;
    if (financeChart) financeChart.destroy();
    financeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Prihodi', 'Troškovi', 'Saldo'],
        datasets: [{
          label: 'Financijski pregled',
          data: [totalIncome, totalExpenses, balance],
          backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)'],
          borderWidth: 1
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }

  function createBudgetChart(expenses, budgets) {
    const container = document.getElementById('budgetChart').parentElement;
    if (!container) return;
    if (budgetChart) budgetChart.destroy();
    
    // Ako nema podataka, prikaži poruku
    if (!Array.isArray(budgets) || budgets.length === 0) {
        container.innerHTML = `<h2>Pregled budžeta</h2><p>Niste postavili budžete za ovaj mjesec. <a href="budgets.html">Postavite budžete</a> za bolju kontrolu troškova.</p><canvas id="budgetChart" style="display: none;"></canvas>`;
        return; 
    }
    
    // Ako podaci postoje, osiguraj da je canvas vidljiv
    if (!container.querySelector('canvas') || container.querySelector('canvas').style.display === 'none') {
        container.innerHTML = `<h2>Pregled budžeta</h2><canvas id="budgetChart"></canvas>`;
    }
    const ctx = document.getElementById('budgetChart').getContext('2d');

    // Priprema podataka za graf
    const expensesByCategory = expenses.reduce((acc, exp) => {
      if(exp.category) acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount || 0);
      return acc;
    }, {});

    const categories = budgets.map(b => b.category);
    const budgetAmounts = budgets.map(b => parseFloat(b.amount || 0));
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

    // Crtanje grafa
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
      options: { responsive: true, scales: { x: { stacked: false }, y: { beginAtZero: true, stacked: false } } }
    });
  }

  function createCategoriesChart(expenses) {
    const container = document.getElementById('categoriesChart').parentElement;
    if (!container) return;
    if (categoriesChart) categoriesChart.destroy();
    
    if (!Array.isArray(expenses) || expenses.length === 0) {
        container.innerHTML = `<h2>Troškovi po kategorijama</h2><p>Nema troškova za prikaz u ovom mjesecu.</p><canvas id="categoriesChart" style="display: none;"></canvas>`;
        return;
    }

    if (!container.querySelector('canvas') || container.querySelector('canvas').style.display === 'none') {
        container.innerHTML = `<h2>Troškovi po kategorijama</h2><canvas id="categoriesChart"></canvas>`;
    }
    const ctx = document.getElementById('categoriesChart').getContext('2d');
    
    const categories = expenses.reduce((acc, exp) => {
      if(exp.category) acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount || 0);
      return acc;
    }, {});

    const labels = Object.keys(categories);
    const amounts = Object.values(categories);
    // Dinamičko generiranje boja za onoliko kategorija koliko ih ima
    const backgroundColors = labels.map((_, i) => `hsl(${(i * 45)}deg, 70%, 60%)`);

    categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: amounts, backgroundColor: backgroundColors }]
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
  }

  // --- FUNKCIJE ZA MODAL I AUTENTIKACIJU ---

  window.showMonthlyComparison = async function() {
    try {
      const response = await fetch(`/income/transactions/comparison?user_id=${localStorage.getItem('userId')}`, { headers: getAuthHeader() });
      if (!response.ok) throw new Error('Greška pri dohvaćanju podataka za usporedbu');
      
      let comparisonData = await response.json();
      // Potrebna su barem dva mjeseca za usporedbu
      if (!Array.isArray(comparisonData) || comparisonData.length < 2) {
        showAlert("Nema dovoljno podataka za mjesečnu usporedbu.", "info");
        return;
      }
      
      comparisonData.sort((a,b) => a.month.localeCompare(b.month));

      const labels = comparisonData.map(item => {
        const [year, month] = item.month.split('-');
        return new Date(year, month - 1).toLocaleString('hr-HR', { month: 'short', year: 'numeric' });
      });

      const incomeData = comparisonData.map(item => item.income || 0);
      const expensesData = comparisonData.map(item => item.expenses || 0);

      const modal = document.getElementById('comparisonModal');
      const ctx = document.getElementById('comparisonChart').getContext('2d');
      if (comparisonChart) comparisonChart.destroy();

      comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Prihodi',
            data: incomeData,
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
          }, {
            label: 'Troškovi',
            data: expensesData,
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } },
          plugins: { title: { display: true, text: 'Mjesečna usporedba prihoda i troškova' } }
        }
      });
      modal.style.display = 'block';
    } catch (error) {
      console.error('Greška kod prikaza usporedbe:', error);
      showAlert(`Greška pri učitavanju usporedbe: ${error.message}`, 'error');
    }
  };

  window.hideComparisonModal = function() {
    document.getElementById('comparisonModal').style.display = 'none';
  };
  
  // Pomoćne funkcije koje bi trebale biti u auth.js, ali ih dodajemo ovdje za potpunost
  function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("Korisnik nije prijavljen, preusmjeravanje na početnu stranicu.");
        // window.location.href = 'index.html'; // Odkomentirati u produkciji
        return false;
    }
    return true;
  }
  
  function getAuthHeader() {
    return { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
  }
  
  function showAlert(message, type='error') {
    let alertBox = document.querySelector('.alert-box');
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.style.position = 'fixed';
        alertBox.style.top = '20px';
        alertBox.style.right = '20px';
        alertBox.style.padding = '15px';
        alertBox.style.borderRadius = '5px';
        alertBox.style.color = 'white';
        alertBox.style.zIndex = '1001';
        alertBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        document.body.appendChild(alertBox);
    }
    alertBox.className = `alert-box alert-${type}`;
    alertBox.style.backgroundColor = type === 'error' ? '#dc3545' : (type === 'info' ? '#17a2b8' : '#28a745');
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
  }
});
