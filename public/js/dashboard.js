document.addEventListener('DOMContentLoaded', async () => {
  // Osiguraj da su funkcije iz auth.js dostupne
  if (typeof checkAuth !== 'function' || typeof getAuthHeader !== 'function' || typeof showAlert !== 'function') {
      console.error("Osnovne funkcije iz auth.js nisu dostupne!");
      // Možda preusmjeri na login ili prikaži poruku o grešci
      // showAlert("Došlo je do greške pri učitavanju skripti.", "error");
      alert("Došlo je do greške pri učitavanju skripti. Provjerite konzolu."); // Jednostavniji alert
      return;
  }

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
  let currentMonthIndex = 0; // Index u availableMonths polju (sortirano ASC)

  try {
    document.getElementById('welcomeMessage').textContent = `Dobrodošli, ${localStorage.getItem('username')}!`;
    await loadAvailableMonths(); // Prvo učitaj i sortiraj mjesece

    // Postavi na najnoviji mjesec inicijalno
    if (availableMonths.length > 0) {
        currentMonthIndex = availableMonths.length - 1; // Zadnji element je najnoviji jer sortiramo ASC
        const [year, month] = availableMonths[currentMonthIndex].split('-');
        currentYear = parseInt(year);
        currentMonth = parseInt(month) - 1;
    }
    // Ako nema dostupnih mjeseci, ostat će trenutni kalendarski mjesec

    await loadData(); // Učitaj podatke za inicijalni mjesec
    updateNavigationButtons(); // Ažuriraj gumbe

  } catch (error) {
    console.error('Detalji greške pri inicijalizaciji:', error);
    showAlert(`Greška pri inicijalizaciji: ${error.message}`, 'error');
    if (error.message.includes('token') || error.message.includes('401')) {
      localStorage.clear();
      window.location.href = 'index.html'; // Preusmjeri na index (bivši login)
    }
  }

  // Funkcije za promjenu mjeseca
  window.changeMonth = function(offset) {
    // Offset: -1 za prethodni (stariji), +1 za sljedeći (noviji)
     // Mjeseci su sortirani ASC (0=najstariji, length-1=najnoviji)
     // Za "Prethodni" (lijevo dugme) želimo manji index -> -1
     // Za "Sljedeći" (desno dugme) želimo veći index -> +1
    const newIndex = currentMonthIndex + offset;

    // Provjeri granice
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

    loadData();
    updateNavigationButtons();
  };

  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

    if (!prevButton || !nextButton) {
        console.warn("Gumbi za navigaciju mjeseci nisu pronađeni.");
        return;
    }


    if (availableMonths.length <= 1) { // Onemogući ako je 0 ili 1 mjesec
      prevButton.disabled = true;
      nextButton.disabled = true;
    } else {
      // Sortirano ASC (0=najstariji, length-1=najnoviji)
      prevButton.disabled = currentMonthIndex === 0; // Onemogući "Prethodni" ako smo na najstarijem
      nextButton.disabled = currentMonthIndex === availableMonths.length - 1; // Onemogući "Sljedeći" ako smo na najnovijem
    }

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
        let errorMsg = 'Greška pri dohvaćanju dostupnih mjeseci';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      availableMonths = await response.json();
      // Sortiraj mjesece ASC (od najstarijeg prema najnovijem)
      availableMonths.sort((a, b) => a.localeCompare(b));
      console.log("Dostupni mjeseci (sortirano ASC):", availableMonths);

    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      showAlert(`Greška u dohvaćanju liste mjeseci: ${error.message}`, 'error');
      availableMonths = [];
    }
  }

  async function loadData() {
    try {
      updateMonthDisplay();
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const previousMonthStr = getPreviousMonthString();
      console.log(`Učitavam podatke za: ${monthString}, prethodni: ${previousMonthStr}`);


      const [incomesRes, expensesRes, budgetsRes, prevMonthRes] = await Promise.all([
        fetch(`/income?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { headers: getAuthHeader() }),
        fetch(`/expenses?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { headers: getAuthHeader() }),
        fetch(`/budgets?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { headers: getAuthHeader() }),
        fetch(`/income/summary?user_id=${localStorage.getItem('userId')}&month=${previousMonthStr}`, { headers: getAuthHeader() })
      ]);

      // --- Obrada Odgovora ---
      let incomes = [];
      if (incomesRes.ok) incomes = await incomesRes.json();
      else console.warn(`Income API error: ${incomesRes.status}`);

      let expenses = [];
      if (expensesRes.ok) expenses = await expensesRes.json();
      else console.warn(`Expenses API error: ${expensesRes.status}`);

      let budgets = [];
      if (budgetsRes.ok) {
          try { budgets = await budgetsRes.json(); }
          catch (e) { console.error("Greška parsiranja budžeta:", e, await budgetsRes.text().catch(()=>"")); }
      } else { console.warn(`Budgets API error: ${budgetsRes.status}`); }

      previousMonthData = { income: 0, expenses: 0, balance: 0 };
      if (prevMonthRes.ok) {
          try { previousMonthData = await prevMonthRes.json(); }
          catch (e) { console.error("Greška parsiranja prethodnog mjeseca:", e, await prevMonthRes.text().catch(()=>"")); }
      } else { console.warn("Neuspješan dohvat prethodnog mjeseca:", prevMonthRes.status); }
      // --- Kraj Obrade Odgovora ---

      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const balance = totalIncome - totalExpenses;

      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

      const balanceChange = balance - (previousMonthData.balance || 0);
      const balanceChangeElement = document.getElementById('balanceChange');
      if (balanceChangeElement) {
        balanceChangeElement.innerHTML = balanceChange >= 0 ?
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
    // Sortirano ASC, index 0 je najstariji
    if (currentMonthIndex > 0 && availableMonths.length > currentMonthIndex) {
      return availableMonths[currentMonthIndex - 1]; // Prethodni u listi
    }
    // Ako smo na najstarijem ili nema liste, izračunaj kalendarski
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }

  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
                      "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    const displayElement = document.getElementById('currentMonth');
    if (displayElement) {
      displayElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
  }

  // --- Funkcije za grafove ---

  function createFinanceChart(totalIncome, totalExpenses, balance) {
    const canvasElement = document.getElementById('financeChart');
    if (!canvasElement) { console.error("Canvas 'financeChart' nije pronađen!"); return; }
    const ctx = canvasElement.getContext('2d');
    if (!ctx) { console.error("Nije moguće dobiti 2D context za 'financeChart'"); return; }


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
           borderColor: [
               'rgba(75, 192, 192, 1)',
               'rgba(255, 99, 132, 1)',
               'rgba(54, 162, 235, 1)'
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
                if (context.parsed.y !== null) label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                return label;
              }
            }
          }
        }
      }
    });
  }

  function createBudgetChart(expenses, budgets) {
    const canvasElement = document.getElementById('budgetChart');
    if (!canvasElement) { console.error("Canvas 'budgetChart' nije pronađen!"); return; }
    const ctx = canvasElement.getContext('2d');
     if (!ctx) { console.error("Nije moguće dobiti 2D context za 'budgetChart'"); return; }


    // Pronađi ili kreiraj element za poruku pored canvasa
    let messageElement = document.getElementById('budgetMessage');
    if (!messageElement) {
        messageElement = document.createElement('p');
        messageElement.id = 'budgetMessage';
         // Umetni poruku NAKON canvasa, ali unutar istog parenta ako je moguće
        canvasElement.parentNode.insertBefore(messageElement, canvasElement.nextSibling);
        messageElement.style.display = 'none'; // Sakrij inicijalno
    }


    if (budgetChart) {
      budgetChart.destroy();
    }

    // Provjeri jesu li budžeti valjani niz
     if (!Array.isArray(budgets)) {
        console.error("Budgets data is not an array:", budgets);
        budgets = []; // Tretiraj kao prazno
    }

    // Filtriraj opet za svaki slučaj (API bi trebao ovo riješiti)
     const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
     const filteredBudgets = budgets.filter(b => b.month === currentMonthStr);


    if (filteredBudgets.length === 0) {
       canvasElement.style.display = 'none'; // Sakrij graf
       messageElement.textContent = `Nema postavljenih budžeta za ${document.getElementById('currentMonth')?.textContent || monthString}.`;
       messageElement.style.display = 'block'; // Pokaži poruku
      return;
    } else {
       canvasElement.style.display = 'block'; // Pokaži graf
       messageElement.style.display = 'none'; // Sakrij poruku
    }


    const expensesByCategory = {};
     // Provjeri jesu li troškovi valjani niz
      if (!Array.isArray(expenses)) {
        console.error("Expenses data is not an array:", expenses);
        expenses = []; // Tretiraj kao prazno
      }
    expenses.forEach(exp => {
      if (!exp.category) return;
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      // Provjeri je li amount broj prije zbrajanja
       const amount = parseFloat(exp.amount || 0);
       if (!isNaN(amount)) {
          expensesByCategory[exp.category] += amount;
       }
    });

    const categories = filteredBudgets.map(b => b.category);
    const budgetAmounts = filteredBudgets.map(b => parseFloat(b.amount || 0));
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

     console.log("Budget Chart Data:", { categories, budgetAmounts, actualAmounts }); // Dodano logiranje

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
                if (context.parsed.x !== null) label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(context.parsed.x);
                return label;
              }
            }
          }
        }
      }
    });
  }

  function createCategoriesChart(expenses) {
     const canvasElement = document.getElementById('categoriesChart');
     if (!canvasElement) { console.error("Canvas 'categoriesChart' nije pronađen!"); return; }
     const ctx = canvasElement.getContext('2d');
     if (!ctx) { console.error("Nije moguće dobiti 2D context za 'categoriesChart'"); return; }


     // Pronađi ili kreiraj element za poruku
      let messageElement = document.getElementById('categoriesMessage');
      if (!messageElement) {
          messageElement = document.createElement('p');
          messageElement.id = 'categoriesMessage';
          canvasElement.parentNode.insertBefore(messageElement, canvasElement.nextSibling);
          messageElement.style.display = 'none'; // Sakrij inicijalno
      }


    if (categoriesChart) {
      categoriesChart.destroy();
    }

     // Provjeri jesu li troškovi valjani niz
      if (!Array.isArray(expenses) || expenses.length === 0) {
         canvasElement.style.display = 'none'; // Sakrij graf
         messageElement.textContent = `Nema troškova za prikaz za ${document.getElementById('currentMonth')?.textContent || ''}.`;
         messageElement.style.display = 'block'; // Pokaži poruku
         return;
      }


    const categories = {};
    expenses.forEach(exp => {
      if (!exp.category) return; // Preskoči ako nema kategorije
      if (!categories[exp.category]) {
        categories[exp.category] = 0;
      }
       const amount = parseFloat(exp.amount || 0);
       if (!isNaN(amount)) {
            categories[exp.category] += amount;
       }
    });

    const labels = Object.keys(categories).filter(cat => categories[cat] > 0); // Filtriraj kategorije s 0 iznosom
    const amounts = labels.map(cat => categories[cat]);

    if (labels.length === 0) {
       canvasElement.style.display = 'none'; // Sakrij graf
       messageElement.textContent = `Nema troškova s kategorijama za prikaz za ${document.getElementById('currentMonth')?.textContent || ''}.`;
       messageElement.style.display = 'block'; // Pokaži poruku
      return;
    } else {
        canvasElement.style.display = 'block'; // Pokaži graf
        messageElement.style.display = 'none'; // Sakrij poruku
    }


    const backgroundColors = labels.map((_, index) => `hsl(${(index * 45 + 10) % 360}, 75%, 65%)`); // Malo drugačije generiranje boja


      console.log("Categories Chart Data:", { labels, amounts }); // Dodano logiranje


    categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Troškovi',
          data: amounts,
          backgroundColor: backgroundColors,
           borderColor: '#fff', // Dodao bijeli border između kriški
           borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                let value = context.parsed || 0;
                let sum = context.dataset.data.reduce((a, b) => a + b, 0);
                let percentage = sum > 0 ? ((value / sum) * 100).toFixed(1) + '%' : '0%';

                if (label) label += ': ';
                label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(value);
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
        const errorData = await response.json().catch(() => ({ error: `HTTP greška ${response.status}` }));
        throw new Error(errorData.error || 'Greška pri dohvaćanju podataka za usporedbu');
      }

      const comparisonData = await response.json();

      if (!Array.isArray(comparisonData) || comparisonData.length === 0) {
        showAlert("Nema podataka za mjesečnu usporedbu.", "info");
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
                  if (context.parsed.y !== null) label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                  return label;
                }
              }
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

 // Osiguraj da showAlert postoji (ako je u auth.js)
  if (typeof showAlert !== 'function') {
      console.error("Funkcija showAlert nije definirana! Provjeri je li auth.js učitan prije dashboard.js.");
       window.showAlert = function(message, type = 'error') { alert(`${type.toUpperCase()}: ${message}`); }
  }
   if (typeof getAuthHeader !== 'function') {
      console.error("Funkcija getAuthHeader nije definirana! Provjeri je li auth.js učitan prije dashboard.js.");
       window.getAuthHeader = function() {
           const token = localStorage.getItem('token');
           return {
               'Authorization': `Bearer ${token}`,
               'Content-Type': 'application/json'
           };
       }
   }

});