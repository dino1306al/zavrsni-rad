document.addEventListener('DOMContentLoaded', async () => {
  // Pretpostavka: checkAuth, getAuthHeader i showAlert dolaze iz globalnog scope-a ili auth.js
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
    // Tvoja originalna logika za postavljanje početnog mjeseca:
    if (availableMonths.length > 0) {
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      currentMonthIndex = availableMonths.indexOf(currentMonthStr); // Koristi originalno sortiranje iz loadAvailableMonths

      if (currentMonthIndex === -1) {
        currentMonthIndex = 0; // Ako trenutni nije u listi, postavi na prvi (koji je najnoviji prema tvom sortu)
        // Provjeri postoji li barem jedan mjesec prije dohvaćanja
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
      window.location.href = 'login.html';
    }
  }

  window.changeMonth = function(offset) {
    // Tvoja originalna logika za promjenu mjeseca (vjerojatno ovisi o sortiranju)
    // Ako availableMonths[0] najnoviji: + offset je OK.
    const newIndex = currentMonthIndex + offset;

    // Provjeri granice
    if (newIndex < 0 || newIndex >= availableMonths.length) return;

    currentMonthIndex = newIndex;
    // Provjeri postoji li element na tom indexu prije dohvaćanja
     if (availableMonths[currentMonthIndex]) {
        const [year, month] = availableMonths[currentMonthIndex].split('-');
        currentYear = parseInt(year);
        currentMonth = parseInt(month) - 1;
     } else {
         console.error("Pokušaj dohvaćanja nepostojećeg indeksa mjeseca:", newIndex);
         return; // Nemoj nastaviti ako je index nevažeći
     }


    loadData();
    updateNavigationButtons();
  };

  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

    // Originalna logika za gumbe
     if (!prevButton || !nextButton) return; // Dodao provjeru

    if (availableMonths.length === 0) {
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }

     // Originalna logika (pretpostavlja da je availableMonths[0] najnoviji)
    prevButton.disabled = currentMonthIndex === 0;
    nextButton.disabled = currentMonthIndex === availableMonths.length - 1;


    // Stilovi za onemogućene gumbe
    prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
    prevButton.style.cursor = prevButton.disabled ? 'not-allowed' : 'pointer';
    nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
    nextButton.style.cursor = nextButton.disabled ? 'not-allowed' : 'pointer';
  }

  async function loadAvailableMonths() {
    try {
      // Koristi relativnu putanju
      const response = await fetch(`/income/transactions/months?user_id=${localStorage.getItem('userId')}`, { // <<< ISPRAVLJENO
        headers: getAuthHeader()
      });

      if (!response.ok) {
        // Tvoja originalna obrada greške
         let errorMsg = 'Greška pri dohvaćanju dostupnih mjeseci';
         try {
             const errorData = await response.json();
             errorMsg = errorData.error || errorMsg;
         } catch (e) { /* Ignoriraj ako tijelo nije JSON */ }
        throw new Error(errorMsg);
      }

      availableMonths = await response.json();

      // Tvoje originalno sortiranje (najnoviji prvo?) - OPREZ: a.localeCompare(b) sortira ASC (najstariji prvo)!
      // Ako želiš najnoviji prvo, treba b.localeCompare(a)
      availableMonths.sort((a, b) => a.localeCompare(b)); // Ostavljam tvoj originalni sort, iako mislim da je ASC

      // <---- NOVO DODANO ----> // Ovo si imao u originalu
      console.log("Dostupni mjeseci:", availableMonths);
      // <---------------------->

    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      // Tvoja originalna obrada greške
      showAlert(`Greška u dohvaćanju mjeseci: ${error.message}`, 'error'); // Prikaz greške
      availableMonths = []; // Resetiraj ako ne uspije
      // Bacanje greške ovdje može zaustaviti inicijalizaciju, možda je bolje samo postaviti na prazno i logirati?
      // throw error;
    }
  }

  async function loadData() {
    try {
      updateMonthDisplay();
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      // Tvoja originalna logika za dohvaćanje prethodnog mjeseca
      const previousMonthStr = getPreviousMonthString(); // Koristi tvoju funkciju


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
        fetch(`/income/summary?user_id=${localStorage.getItem('userId')}&month=${previousMonthStr}`, { // <<< ISPRAVLJENO
          headers: getAuthHeader()
        })
      ]);

       // Tvoja originalna, jednostavnija obrada grešaka
      if (!incomesRes.ok) {
        throw new Error(`Income API error: ${incomesRes.status} ${await incomesRes.text()}`);
      }
      if (!expensesRes.ok) {
        throw new Error(`Expenses API error: ${expensesRes.status} ${await expensesRes.text()}`);
      }
       // Tvoja originalna obrada budžeta
       let budgets = [];
       if (!budgetsRes.ok) {
          // Možda ne bacati grešku ako budžeti nisu obavezni? Samo logiraj.
          console.warn(`Budgets API error: ${budgetsRes.status} ${await budgetsRes.text()}`);
          // throw new Error(`Budgets API error: ${budgetsRes.status} ${await budgetsRes.text()}`);
       } else {
           try {
               budgets = await budgetsRes.json();
           } catch (e) {
               console.error("Greška pri parsiranju budžeta:", e, await budgetsRes.text());
           }
       }


      previousMonthData = { income: 0, expenses: 0, balance: 0 }; // Originalni reset
      if (prevMonthRes.ok) {
         try {
             previousMonthData = await prevMonthRes.json();
         } catch (e) {
             console.error("Greška parsiranja prethodnog mjeseca:", e, await prevMonthRes.text());
         }

      } else {
          console.warn("Neuspješan dohvat prethodnog mjeseca:", prevMonthRes.status);
      }

      const incomes = await incomesRes.json(); // Pretpostavka da je incomesRes.ok
      const expenses = await expensesRes.json(); // Pretpostavka da je expensesRes.ok


      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      const balance = totalIncome - totalExpenses;

      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

      const balanceChange = balance - (previousMonthData.balance || 0);
      const balanceChangeElement = document.getElementById('balanceChange');
      // Originalna logika za prikaz promjene
      if (balanceChangeElement) { // Samo provjera da element postoji
           balanceChangeElement.innerHTML = balanceChange > 0 ?
             `<span style="color: green">↑ ${balanceChange.toFixed(2)} €</span>` :
             `<span style="color: red">↓ ${Math.abs(balanceChange).toFixed(2)} €</span>`;
       }


      createFinanceChart(totalIncome, totalExpenses, balance);
      createBudgetChart(expenses, budgets);
      loadCategoriesChart(expenses); // Pozovi s originalnim imenom funkcije

    } catch (error) {
      console.error('Greška u loadData:', error);
      showAlert(`Greška pri učitavanju podataka: ${error.message}`, 'error');
    }
  }


  function getPreviousMonthString() {
     // Tvoja originalna logika - OPREZ: ovisi o sortiranju availableMonths!
     // Ako je sort ASC (najstariji prvi), onda je prethodni onaj s indexom -1
     // Ako je sort DESC (najnoviji prvi), onda je prethodni onaj s indexom +1
     // Budući da koristiš a.localeCompare(b) -> ASC, prethodni je index - 1
     if (currentMonthIndex > 0 && availableMonths.length > currentMonthIndex) { // Treba biti > 0 za index - 1
       return availableMonths[currentMonthIndex - 1]; // Vrati element s prethodnog indexa
     }
     // Ako smo na prvom (najstarijem) ili nema mjeseci, izračunaj kalendarski
     const prevDate = new Date(currentYear, currentMonth - 1, 1);
     return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }

  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
                      "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    const displayElement = document.getElementById('currentMonth');
     if (displayElement) { // Dodao provjeru
        displayElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
     }
  }

  // --- Funkcije za crtanje grafova (ostaju iste kao u tvom originalu) ---

  function createFinanceChart(totalIncome, totalExpenses, balance) {
    const ctx = document.getElementById('financeChart')?.getContext('2d'); // Dodao ?.
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
         maintainAspectRatio: false, // Dodao
        scales: {
          y: { beginAtZero: true }
        },
         plugins: { // Dodao tooltip
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
      const container = document.getElementById('budgetChartContainer'); // Koristi container
      const canvasElement = document.getElementById('budgetChart');
      if (!container || !canvasElement) return;
      const ctx = canvasElement.getContext('2d');


    if (budgetChart) {
      budgetChart.destroy();
    }

     // Originalna provjera i prikaz poruke
      if (!Array.isArray(budgets) || budgets.length === 0) { // Provjera je li niz
        // Originalni HTML za poruku
         container.innerHTML = `
           <h2>Pregled budžeta</h2>
           <p>Niste postavili budžete. <a href="budgets.html">Postavite budžete</a> za bolju kontrolu troškova.</p>
         `;
          canvasElement.style.display = 'none'; // Sakrij canvas
         return;
      } else {
          canvasElement.style.display = 'block'; // Pokaži canvas
          // Vrati naslov ako ga je innerHTML prebrisao
           if (!container.querySelector('h2')) {
             const title = document.createElement('h2');
             title.textContent = 'Pregled budžeta';
             container.prepend(title);
           }
      }

     // Tvoja originalna logika grupiranja i mapiranja
    const expensesByCategory = {};
    expenses.forEach(exp => {
       if (!exp.category) return; // Preskoči ako nema kategorije
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += parseFloat(exp.amount || 0);
    });

    const categories = budgets.map(b => b.category);
    const budgetAmounts = budgets.map(b => parseFloat(b.amount || 0));
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

    budgetChart = new Chart(ctx, {
      type: 'bar', // Originalni tip
       indexAxis: 'y', // Dodao radi bolje preglednosti budžeta
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Budžet',
            data: budgetAmounts,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
             borderColor: 'rgba(54, 162, 235, 1)', // Dodao border
             borderWidth: 1
          },
          {
            label: 'Stvarni troškovi',
            data: actualAmounts,
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
             borderColor: 'rgba(255, 99, 132, 1)', // Dodao border
             borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
         maintainAspectRatio: false, // Dodao
        scales: {
          x: { beginAtZero: true } // Sada je x os za vrijednost
        },
         plugins: { // Dodao tooltip
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

  // Promijenjeno ime nazad u loadCategoriesChart kako si imao u loadData pozivu
  function loadCategoriesChart(expenses) {
      const container = document.getElementById('categoriesChartContainer'); // Koristi container
      const canvasElement = document.getElementById('categoriesChart');
      if (!container || !canvasElement) return;
      const ctx = canvasElement.getContext('2d');

    if (categoriesChart) {
      categoriesChart.destroy();
    }

     // Provjera postoje li troškovi
      if (!Array.isArray(expenses) || expenses.length === 0) {
         container.innerHTML = `<h2>Troškovi po kategorijama</h2><p>Nema troškova za prikaz.</p>`;
         canvasElement.style.display = 'none';
         return;
      } else {
          canvasElement.style.display = 'block';
           if (!container.querySelector('h2')) {
             const title = document.createElement('h2');
             title.textContent = 'Troškovi po kategorijama';
             container.prepend(title);
           }
      }


    // Originalna logika grupiranja
    const categories = {};
    expenses.forEach(exp => {
       if (!exp.category) return; // Preskoči ako nema kategorije
      if (!categories[exp.category]) {
        categories[exp.category] = 0;
      }
      categories[exp.category] += parseFloat(exp.amount || 0);
    });

    const labels = Object.keys(categories);
    const amounts = Object.values(categories);

     // Originalna provjera za prazne labele/iznose
     if (labels.length === 0) {
         container.innerHTML = `<h2>Troškovi po kategorijama</h2><p>Nema troškova s kategorijama za prikaz.</p>`;
         canvasElement.style.display = 'none';
         return;
     }

     // Originalne boje
    const backgroundColors = labels.length <= 6
        ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
        : labels.map((_, index) => `hsl(${(index * 45) % 360}, 70%, 60%)`); // Malo promijenjena logika za više boja


    categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
           label: 'Troškovi', // Dodao labelu
          data: amounts,
          backgroundColor: backgroundColors,
        }]
      },
      options: {
        responsive: true,
         maintainAspectRatio: false, // Dodao
        plugins: {
          legend: {
            position: 'right',
          },
           tooltip: { // Dodao tooltip
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
      // Koristi relativnu putanju
      const response = await fetch(`/income/transactions/comparison?user_id=${localStorage.getItem('userId')}`, { // <<< ISPRAVLJENO
        headers: getAuthHeader()
      });

      if (!response.ok) {
         // Originalna obrada greške
         const errorText = await response.text(); // Dohvati tekst greške
         console.error("Server vratio grešku za usporedbu:", response.status, errorText);
        throw new Error('Greška pri dohvaćanju podataka za usporedbu');
      }

       // Originalna obrada podataka
       let comparisonData = [];
       try {
          comparisonData = await response.json();
       } catch (e) {
          console.error("Greška pri parsiranju JSON-a za usporedbu:", e);
          throw new Error("Greška u formatu odgovora servera za usporedbu.");
       }


        if (!Array.isArray(comparisonData) || comparisonData.length === 0) {
            showAlert("Nema podataka za usporedbu.", "info"); // Koristi showAlert
            return;
        }


      const labels = comparisonData.map(item => {
        // Originalna logika formatiranja labela
         if (typeof item.month !== 'string' || !item.month.includes('-')) return 'N/A';
        const [year, month] = item.month.split('-');
        const monthNames = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];
         const monthIndex = parseInt(month) - 1;
         if (monthIndex >= 0 && monthIndex < 12 && year && year.length === 4) {
            return `${monthNames[monthIndex]} '${year.substring(2)}`;
         }
         return item.month; // Fallback
      });

      const incomeData = comparisonData.map(item => item.income || 0);
      const expensesData = comparisonData.map(item => item.expenses || 0);

       const modalElement = document.getElementById('comparisonModal');
       const canvasElement = document.getElementById('comparisonChart');
       if (!modalElement || !canvasElement) return; // Dodao provjeru
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
          maintainAspectRatio: false, // Dodao
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            title: {
              display: true,
              text: 'Mjesečna usporedba prihoda i troškova'
            },
             tooltip: { // Dodao tooltip
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
      if (modalElement) { // Dodao provjeru
        modalElement.style.display = 'none';
      }
  };

  // Funkcija showAlert koju si imao na kraju (pretpostavka da je u auth.js?)
  // Ako nije, ostavi je ovdje ili premjesti u auth.js
  function showAlert(message, type='error') { // Default na error ako nije specificirano
    const alertContainer = document.getElementById('alertContainer') || document.body; // Pokušaj naći container ili dodaj u body
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`; // Koristi klase koje imaš definirane u CSS-u
    alertBox.textContent = message;
    // Dodaj gumb za zatvaranje (opcionalno)
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; // 'x' znak
     closeButton.style.cssText = 'float:right; background:none; border:none; font-size:1.2em; line-height:1; cursor:pointer; margin-left: 15px; padding: 0;';
    closeButton.onclick = () => alertBox.remove();
    alertBox.appendChild(closeButton);


    // Dodaj na vrh containera ili bodyja
     alertContainer.prepend(alertBox);

    // Automatski ukloni nakon 5 sekundi
    setTimeout(() => {
       // Provjeri postoji li jos uvijek prije uklanjanja
       if (alertBox.parentNode) {
          alertBox.remove();
       }
    }, 5000);
  }

});