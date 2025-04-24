document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return; // Pretpostavka da checkAuth() dolazi iz auth.js

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
        currentMonthIndex = 0; // Postavi na najnoviji dostupni ako trenutni ne postoji u listi
         // Provjeri postoji li barem jedan mjesec prije nego pokušaš pristupiti indexu 0
         if (availableMonths.length > 0) {
            const [year, month] = availableMonths[0].split('-');
            currentYear = parseInt(year);
            currentMonth = parseInt(month) - 1;
         } else {
             // Nema dostupnih mjeseci, ostavi trenutni datum
             console.warn("Nema dostupnih mjeseci s transakcijama.");
         }
      }
    }

    await loadData(); // Učitaj podatke za (potencijalno) novopostavljeni mjesec/godinu
    updateNavigationButtons();
  } catch (error) {
    console.error('Detalji greške pri inicijalizaciji:', error);
    showAlert(`Greška pri inicijalizaciji: ${error.message}`, 'error');
    // Ovdje ne mora nužno biti greška s tokenom, može biti i mrežna greška
    // if (error.message.includes('token') || error.message.includes('401')) {
    //   localStorage.clear();
    //   window.location.href = 'login.html';
    // }
  }

  window.changeMonth = function(offset) {
    const newIndex = currentMonthIndex - offset; // Obrnuto jer su mjeseci sortirani od najstarijeg? Provjeri sortiranje dolje! Ako su od najnovijeg, onda je + offset. Sudeći po a.localeCompare(b), sortirani su ASC (najstariji prvo), pa je - offset OK za ići prema novijem.

    // Provjeri granice
    if (newIndex < 0 || newIndex >= availableMonths.length) return;

    currentMonthIndex = newIndex;
    const [year, month] = availableMonths[currentMonthIndex].split('-');
    currentYear = parseInt(year);
    currentMonth = parseInt(month) - 1;

    loadData(); // Učitaj podatke za novi mjesec
    updateNavigationButtons();
  };

  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

     // Provjeri postoje li gumbi uopće
     if (!prevButton || !nextButton) return;

    // Onemogući gumbe ako nema dostupnih mjeseci
    if (availableMonths.length <= 1) { // Onemogući ako je 0 ili 1 mjesec
      prevButton.disabled = true;
      nextButton.disabled = true;
    } else {
        // Provjeri sortiranje! Ako availableMonths[0] najstariji:
        prevButton.disabled = currentMonthIndex === availableMonths.length - 1; // Onemogući "Prethodni" ako smo na najstarijem (zadnji u listi)
        nextButton.disabled = currentMonthIndex === 0; // Onemogući "Sljedeći" ako smo na najnovijem (prvi u listi)

       // Ako availableMonths[0] najnoviji (kako je bilo u tvom kodu):
       // prevButton.disabled = currentMonthIndex === 0; // Onemogući "Prethodni" ako smo na najnovijem
       // nextButton.disabled = currentMonthIndex === availableMonths.length - 1; // Onemogući "Sljedeći" ako smo na najstarijem
    }

    // Stilovi za onemogućene gumbe
    prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
    prevButton.style.cursor = prevButton.disabled ? 'not-allowed' : 'pointer';
    nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
    nextButton.style.cursor = nextButton.disabled ? 'not-allowed' : 'pointer';
  }

  async function loadAvailableMonths() {
    try {
      const response = await fetch(`/income/transactions/months?user_id=${localStorage.getItem('userId')}`, { // <<< ISPRAVLJENO
        headers: getAuthHeader() // Pretpostavka da getAuthHeader() dolazi iz auth.js
      });

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({ error: `HTTP greška ${response.status}` }));
        throw new Error(errorData.error || 'Greška pri dohvaćanju dostupnih mjeseci');
      }

      availableMonths = await response.json();

       // Sortiraj mjesece ASC (od najstarijeg prema najnovijem) da bi navigacija bila logična
       // Ako želiš najnoviji prvo, koristi b.localeCompare(a)
      availableMonths.sort((a, b) => a.localeCompare(b));

      console.log("Dostupni mjeseci (sortirani):", availableMonths);

      // Postavi index na najnoviji mjesec (zadnji u sortiranoj listi)
      if (availableMonths.length > 0) {
          currentMonthIndex = availableMonths.length - 1;
          const [year, month] = availableMonths[currentMonthIndex].split('-');
          currentYear = parseInt(year);
          currentMonth = parseInt(month) - 1;
      }


    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      showAlert(`Greška: ${error.message}`, 'error'); // Prikazi grešku korisniku
      throw error; // Ponovno baci grešku da zaustavi inicijalizaciju ako treba
    }
  }

  async function loadData() {
    try {
      updateMonthDisplay();
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      console.log(`Učitavam podatke za: ${monthString}`); // Dodano za debug

       // Dohvati prethodni mjesec za usporedbu stanja
       let previousMonthString = '';
       if (currentMonthIndex > 0) { // Provjeri postoji li prethodni mjesec u listi
           previousMonthString = availableMonths[currentMonthIndex - 1];
       } else {
           // Ako je ovo najstariji mjesec, izračunaj prethodni kalendarski mjesec
           const prevDate = new Date(currentYear, currentMonth - 1, 1);
           previousMonthString = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
       }
       console.log(`Prethodni mjesec za usporedbu: ${previousMonthString}`); // Dodano za debug


      const [incomesRes, expensesRes, budgetsRes, prevMonthRes] = await Promise.all([
        fetch(`/income?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { // <<< ISPRAVLJENO
          headers: getAuthHeader()
        }),
        fetch(`/expenses?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { // <<< ISPRAVLJENO
          headers: getAuthHeader()
        }),
        fetch(`/budgets?user_id=${localStorage.getItem('userId')}&month=${monthString}`, { // <<< ISPRAVLJENO
          headers: getAuthHeader()
        }),
        fetch(`/income/summary?user_id=${localStorage.getItem('userId')}&month=${previousMonthString}`, { // <<< ISPRAVLJENO
          headers: getAuthHeader()
        })
      ]);

      // Bolja obrada grešaka za svaki fetch
      if (!incomesRes.ok) {
          const errorData = await incomesRes.json().catch(() => ({ error: `Income API greška ${incomesRes.status}` }));
          throw new Error(errorData.error || `Income API greška ${incomesRes.status}`);
      }
      if (!expensesRes.ok) {
           const errorData = await expensesRes.json().catch(() => ({ error: `Expenses API greška ${expensesRes.status}` }));
          throw new Error(errorData.error || `Expenses API greška ${expensesRes.status}`);
      }
      if (!budgetsRes.ok) {
          const errorData = await budgetsRes.json().catch(() => ({ error: `Budgets API greška ${budgetsRes.status}` }));
          throw new Error(errorData.error || `Budgets API greška ${budgetsRes.status}`);
      }

      let previousMonthData = { income: 0, expenses: 0, balance: 0 };
      if (prevMonthRes.ok) {
        try {
            previousMonthData = await prevMonthRes.json();
        } catch (e) {
            console.error("Greška pri parsiranju odgovora za prethodni mjesec:", e);
            // Nastavi s default vrijednostima ako parsiranje ne uspije
        }
      } else {
           console.warn(`Nije uspio dohvat sažetka za prethodni mjesec (${previousMonthString}): ${prevMonthRes.status}`);
      }


      const incomes = await incomesRes.json();
      const expenses = await expensesRes.json();
      const budgets = await budgetsRes.json(); // Pretpostavka da budgets ruta vraća samo za traženi mjesec

      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const balance = totalIncome - totalExpenses;

      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

      const balanceChange = balance - previousMonthData.balance;
      const balanceChangeElement = document.getElementById('balanceChange');
      if (balanceChangeElement) { // Provjeri postoji li element
          if (balance === previousMonthData.balance && previousMonthData.balance === 0 && totalIncome === 0 && totalExpenses === 0) {
             // Ako nema promjene i sve je nula, ne prikazuj ništa ili posebnu poruku
             balanceChangeElement.innerHTML = ''; // Ili '<small>Nema usporedbe</small>'
          } else if (balanceChange >= 0) {
            balanceChangeElement.innerHTML = `<span style="color: green;">↑ ${balanceChange.toFixed(2)} €</span> <small>(vs ${previousMonthString})</small>`;
          } else {
            balanceChangeElement.innerHTML = `<span style="color: red;">↓ ${Math.abs(balanceChange).toFixed(2)} €</span> <small>(vs ${previousMonthString})</small>`;
          }
      }


      createFinanceChart(totalIncome, totalExpenses, balance);
      createBudgetChart(expenses, budgets); // Pošalji samo troškove i budžete za TRENUTNI mjesec
      loadCategoriesChart(expenses); // Pošalji samo troškove za TRENUTNI mjesec

    } catch (error) {
      console.error('Greška u loadData:', error);
      showAlert(`Greška pri učitavanju podataka: ${error.message}`, 'error');
    }
  }

  // Nema potrebe mijenjati getPreviousMonthString jer on samo računa string

  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
                      "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    const displayElement = document.getElementById('currentMonth');
    if (displayElement) { // Provjeri postoji li element
        displayElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
  }

  function createFinanceChart(totalIncome, totalExpenses, balance) {
    const ctx = document.getElementById('financeChart')?.getContext('2d'); // Dodan optional chaining
    if (!ctx) return; // Izađi ako canvas ne postoji

    if (financeChart) {
      financeChart.destroy();
    }

    financeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Prihodi', 'Troškovi', 'Saldo'],
        datasets: [{
          label: `Financijski pregled (${document.getElementById('currentMonth').textContent})`, // Dodaj mjesec u labelu
          data: [totalIncome, totalExpenses, balance],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)', // Greenish
            'rgba(255, 99, 132, 0.6)', // Reddish
            'rgba(54, 162, 235, 0.6)' // Blueish
          ],
          borderColor: [ // Dodao border radi jasnoće
              'rgba(75, 192, 192, 1)',
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Omogućava bolju kontrolu veličine
        scales: {
          y: { beginAtZero: true }
        },
         plugins: { // Ispis valute na tooltipu
              tooltip: {
                  callbacks: {
                      label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) {
                              label += ': ';
                          }
                          if (context.parsed.y !== null) {
                              label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
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
    const container = document.getElementById('budgetChartContainer'); // Promijenjeno da cilja container div
    const canvas = document.getElementById('budgetChart');
    if (!container || !canvas) return; // Provjeri postoje li oba elementa

    const ctx = canvas.getContext('2d');


    if (budgetChart) {
      budgetChart.destroy();
    }

    // Filtriraj budžete za trenutni mjesec/godinu (iako bi API to trebao raditi)
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const filteredBudgets = budgets.filter(b => b.month === currentMonthStr);


    if (filteredBudgets.length === 0) {
      // Ako nema budžeta, prikaži poruku unutar container diva
      container.innerHTML = `
        <h2>Pregled budžeta</h2>
        <p>Nema postavljenih budžeta za ${document.getElementById('currentMonth').textContent}. <a href="budgets.html">Postavi budžete</a>.</p>
      `;
       // Sakrij canvas ako postoji (iako će ga innerHTML prebrisati)
      canvas.style.display = 'none';
      return;
    } else {
        // Osiguraj da je canvas vidljiv ako je prethodno bio skriven
         canvas.style.display = 'block';
    }


    const expensesByCategory = {};
    expenses.forEach(exp => { // Koristi samo troškove za trenutni mjesec
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += parseFloat(exp.amount);
    });

    const categories = filteredBudgets.map(b => b.category);
    const budgetAmounts = filteredBudgets.map(b => parseFloat(b.amount)); // Osiguraj da su brojevi
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

    budgetChart = new Chart(ctx, {
      type: 'bar',
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
        indexAxis: 'y', // Horizontalni bar chart može biti pregledniji za budžete
        scales: {
          x: { beginAtZero: true } // Sada je x os za vrijednosti
        },
         plugins: {
              tooltip: {
                  callbacks: { // Formatiranje valute
                      label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) {
                              label += ': ';
                          }
                          if (context.parsed.x !== null) { // Sada gledamo x os
                              label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(context.parsed.x);
                          }
                          return label;
                      }
                  }
              }
          }
      }
    });
  }

  async function loadCategoriesChart(expenses) {
     const container = document.getElementById('categoriesChartContainer'); // Promijenjeno da cilja container div
     const canvas = document.getElementById('categoriesChart');
     if (!container || !canvas) return; // Provjeri postoje li oba elementa


    const ctx = canvas.getContext('2d');

    if (categoriesChart) {
      categoriesChart.destroy();
    }

     // Provjeri postoje li troškovi za prikaz
     if (expenses.length === 0) {
         container.innerHTML = `<h2>Troškovi po kategorijama</h2><p>Nema troškova za prikaz za ${document.getElementById('currentMonth').textContent}.</p>`;
         canvas.style.display = 'none'; // Sakrij canvas
         return;
     } else {
          // Osiguraj da je canvas vidljiv ako je prethodno bio skriven
          canvas.style.display = 'block';
          // Osiguraj da je naslov vidljiv (ako ga innerHTML prebriše)
          if (!container.querySelector('h2')) {
             const title = document.createElement('h2');
             title.textContent = 'Troškovi po kategorijama';
             container.prepend(title);
          }
     }


    const categories = {};
    expenses.forEach(exp => { // Koristi samo troškove za trenutni mjesec
      if (!categories[exp.category]) {
        categories[exp.category] = 0;
      }
      categories[exp.category] += parseFloat(exp.amount);
    });

    const labels = Object.keys(categories);
    const amounts = Object.values(categories);

    // Generiraj dinamički boje ako ima više od 6 kategorija
    const backgroundColors = labels.length <= 6
        ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
        : labels.map(() => `hsl(${Math.random() * 360}, 70%, 60%)`); // Generiraj random HSL boje


    categoriesChart = new Chart(ctx, {
      type: 'pie', // Može i 'doughnut'
      data: {
        labels: labels,
        datasets: [{
          label: 'Troškovi', // Dodao labelu za dataset
          data: amounts,
          backgroundColor: backgroundColors,
          // hoverOffset: 4 // Malo izdvajanje na hover
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right', // Ili 'bottom' ako ima puno kategorija
          },
           tooltip: {
                  callbacks: { // Formatiranje valute i postotka
                      label: function(context) {
                          let label = context.label || '';
                           let value = context.parsed || 0;
                           let sum = context.dataset.data.reduce((a, b) => a + b, 0);
                           let percentage = sum > 0 ? ((value / sum) * 100).toFixed(1) + '%' : '0%';


                          if (label) {
                              label += ': ';
                          }
                           label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(value);
                           label += ` (${percentage})`; // Dodaj postotak
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
      // Dohvati SVE podatke za usporedbu, ne samo za trenutni user_id? Treba user_id.
      const response = await fetch(`/income/transactions/comparison?user_id=${localStorage.getItem('userId')}`, { // <<< ISPRAVLJENO
        headers: getAuthHeader()
      });

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({ error: `HTTP greška ${response.status}` }));
        throw new Error(errorData.error || 'Greška pri dohvaćanju podataka za usporedbu');
      }

      const comparisonData = await response.json();

      // Dodaj provjeru ako nema podataka
      if (!comparisonData || comparisonData.length === 0) {
          showAlert('Nema dovoljno podataka za mjesečnu usporedbu.', 'warning');
          return;
      }


      const labels = comparisonData.map(item => {
        const [year, month] = item.month.split('-');
        const monthNames = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];
        // Osiguraj da je month validan broj između 1 i 12
        const monthIndex = parseInt(month) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${monthNames[monthIndex]} '${year.substring(2)}`; // Skraćena godina
        }
        return item.month; // Fallback ako format nije YYYY-MM
      });

      const incomeData = comparisonData.map(item => item.income || 0);
      const expensesData = comparisonData.map(item => item.expenses || 0);

      const modalElement = document.getElementById('comparisonModal');
      const canvasElement = document.getElementById('comparisonChart');
      if (!modalElement || !canvasElement) {
          console.error("Modal ili Canvas element za usporedbu nije pronađen!");
          return;
      }
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
           maintainAspectRatio: false, // Da stane bolje u modal
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            title: {
              display: true,
              text: 'Mjesečna usporedba prihoda i troškova'
            },
             tooltip: {
                  callbacks: { // Formatiranje valute
                      label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) {
                              label += ': ';
                          }
                          if (context.parsed.y !== null) {
                              label += new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                          }
                          return label;
                      }
                  }
              }
          }
        }
      });

      modalElement.style.display = 'block'; // Pokaži modal
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

  // Osiguraj da showAlert i getAuthHeader postoje (ako su u auth.js)
  // Ovo pretpostavlja da je auth.js učitan prije dashboard.js u HTML-u
  if (typeof showAlert !== 'function') {
      console.error("Funkcija showAlert nije definirana!");
       // Fallback ili definicija ako treba
       window.showAlert = function(message, type = 'error') { alert(`${type.toUpperCase()}: ${message}`); }
  }
   if (typeof getAuthHeader !== 'function') {
      console.error("Funkcija getAuthHeader nije definirana!");
       // Fallback ili definicija ako treba
       window.getAuthHeader = function() {
           const token = localStorage.getItem('token');
           return {
               'Authorization': `Bearer ${token}`,
               'Content-Type': 'application/json'
           };
       }
  }


});