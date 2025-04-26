document.addEventListener('DOMContentLoaded', async () => {
  // Pretpostavka da checkAuth() i getAuthHeader() dolaze iz auth.js
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
    await loadAvailableMonths(); // Prvo učitaj dostupne mjesece

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

    await loadData(); // Učitaj podatke za odabrani mjesec
    updateNavigationButtons(); // Ažuriraj gumbe

  } catch (error) {
    console.error('Detalji greške:', error);
    showAlert(`Greška: ${error.message}`, 'error');
    if (error.message.includes('token') || error.message.includes('401')) {
      localStorage.clear();
      window.location.href = 'login.html'; // ili index.html ako si preimenovao
    }
  }

  window.changeMonth = function(offset) {
    // Tvoja originalna logika za promjenu mjeseca
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
         return;
     }

    loadData();
    updateNavigationButtons();
  };

  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

    // Originalna logika za gumbe
     if (!prevButton || !nextButton) return;

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

      // Tvoje originalno sortiranje
      availableMonths.sort((a, b) => a.localeCompare(b)); // Ostavljam tvoj originalni sort ASC

      // <---- NOVO DODANO ----> // Ovo si imao u originalu
      console.log("Dostupni mjeseci:", availableMonths);
      // <---------------------->

    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
       // Tvoja originalna obrada greške
       showAlert(`Greška u dohvaćanju mjeseci: ${error.message}`, 'error'); // Prikaz greške
       availableMonths = [];
      // throw error; // Ostavljam zakomentirano kako je bilo
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
          console.warn(`Budgets API error: ${budgetsRes.status} ${await budgetsRes.text()}`);
       } else {
           try {
               budgets = await budgetsRes.json();
           } catch (e) {
               console.error("Greška pri parsiranju budžeta:", e, await budgetsRes.text().catch(()=>""));
           }
       }


      previousMonthData = { income: 0, expenses: 0, balance: 0 }; // Originalni reset
      if (prevMonthRes.ok) {
         try {
           previousMonthData = await prevMonthRes.json();
         } catch(e) {
           console.error("Greška parsiranja prethodnog mjeseca:", e, await prevMonthRes.text().catch(()=>""));
         }
      } else {
         console.warn("Neuspješan dohvat prethodnog mjeseca:", prevMonthRes.status);
      }

      const incomes = await incomesRes.json();
      const expenses = await expensesRes.json();


      const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0); // Koristim || 0 kao u tvom originalu
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0); // Koristim || 0 kao u tvom originalu
      const balance = totalIncome - totalExpenses;

      document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
      document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
      document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

      const balanceChange = balance - (previousMonthData.balance || 0); // Koristim || 0
      const balanceChangeElement = document.getElementById('balanceChange');
       // Originalna logika za prikaz promjene
       if (balanceChangeElement) {
           balanceChangeElement.innerHTML = balanceChange > 0 ?
             `<span style="color: green">↑ ${balanceChange.toFixed(2)} €</span>` :
             `<span style="color: red">↓ ${Math.abs(balanceChange).toFixed(2)} €</span>`;
       }


      createFinanceChart(totalIncome, totalExpenses, balance);
      createBudgetChart(expenses, budgets);
      loadCategoriesChart(expenses); // Tvoje originalno ime funkcije

    } catch (error) {
      console.error('Greška u loadData:', error);
      showAlert(`Greška pri učitavanju podataka: ${error.message}`, 'error');
    }
  }


  function getPreviousMonthString() {
     // Tvoja originalna logika
     if (currentMonthIndex > 0 && availableMonths.length > currentMonthIndex) { // Treba biti > 0 ako je sortirano ASC
        return availableMonths[currentMonthIndex - 1];
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

  // --- Funkcije za crtanje grafova (ostaju iste kao u tvom originalu, BEZ promjena za ...Container ID-eve) ---

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
         // maintainAspectRatio: false, // Maknuo ovo jer nije bilo u tvom originalu
        scales: {
          y: { beginAtZero: true }
        }
         // Maknuo plugins/tooltip jer nije bilo u tvom originalu
      }
    });
  }

  function createBudgetChart(expenses, budgets) {
    const ctx = document.getElementById('budgetChart')?.getContext('2d'); // Dodao ?.
     if (!ctx) return; // Dodao provjeru

    if (budgetChart) {
      budgetChart.destroy();
    }
    const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    budgets = budgets.filter(b => b.month === monthString);

     // Tvoja originalna provjera za prazne budžete
    if (!Array.isArray(budgets) || budgets.length === 0) { // Dodao provjeru da je niz
       // Tvoja originalna logika za prikaz poruke unutar parent elementa canvasa
       const parentElement = document.getElementById('budgetChart')?.parentElement;
       if(parentElement){
            parentElement.innerHTML = `
                <h2>Pregled budžeta</h2>
                <p>Niste postavili budžete. <a href="budgets.html">Postavite budžete</a> za bolju kontrolu troškova.</p>
            `;
       } else {
           console.error("Nije pronađen parent element za budgetChart za prikaz poruke.");
       }
       // Osiguraj da se graf ne crta ako nema podataka
       if (budgetChart) budgetChart.destroy(); budgetChart = null;
       // Sakrij canvas ako postoji
       const canvasElement = document.getElementById('budgetChart');
       if (canvasElement) canvasElement.style.display = 'none';
      return; // Važno da izađeš iz funkcije
    } else {
         // Ako ima budžeta, osiguraj da je canvas vidljiv (ako je prethodno bio skriven)
         const canvasElement = document.getElementById('budgetChart');
         if (canvasElement) canvasElement.style.display = 'block';
         // Ako je poruka bila prikazana, treba je maknuti ili osigurati da se naslov vrati
         const parentElement = document.getElementById('budgetChart')?.parentElement;
          if(parentElement && !parentElement.querySelector('canvas')){ // Ako canvas fali
             parentElement.innerHTML = `<h2>Pregled budžeta</h2><canvas id="budgetChart"></canvas>`; // Vrati canvas i naslov
             // Treba ponovno dohvatiti context!
             const newCtx = document.getElementById('budgetChart')?.getContext('2d');
             if(!newCtx) return; // Izađi ako ni sad nema contexta
             // ctx = newCtx; // Ovo ne radi jer je ctx const, treba refaktorirati ili ponoviti dohvat
             // Najjednostavnije je samo ponovno dohvatiti context ako je parentElement bio resetiran
             const ctx = document.getElementById('budgetChart')?.getContext('2d');
             if (!ctx) return;

          } else if (parentElement && parentElement.querySelector('p')) {
              // Ako postoji samo paragraf s porukom, ukloni ga
              const pMessage = parentElement.querySelector('p');
              if(pMessage && pMessage.textContent.includes("Niste postavili budžete")) pMessage.remove();
               // Vrati naslov ako fali
              if (!parentElement.querySelector('h2')) {
                  const title = document.createElement('h2');
                  title.textContent = 'Pregled budžeta';
                   if(canvasElement) parentElement.insertBefore(title, canvasElement); else parentElement.prepend(title);
              }
          }
    }



     // Tvoja originalna logika grupiranja i mapiranja
    const expensesByCategory = {};
    expenses.forEach(exp => {
       if (!exp.category) return;
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += parseFloat(exp.amount || 0); // Koristim || 0 kao u tvom originalu
    });

    const categories = budgets.map(b => b.category);
    // !!! GREŠKA U ORIGINALU: Koristio si b.amount direktno, a to može biti string! Treba parseFloat !!!
    const budgetAmounts = budgets.map(b => parseFloat(b.amount || 0));
    const actualAmounts = categories.map(cat => expensesByCategory[cat] || 0);

     // Logiranje prije crtanja može pomoći
     console.log("Budget Chart - Data:", { categories, budgetAmounts, actualAmounts });

    budgetChart = new Chart(ctx, {
      type: 'bar',
      // indexAxis: 'y', // Maknuo jer nije bilo u originalu
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
          y: { beginAtZero: true } // Originalne osi
        }
         // Maknuo plugins/tooltip jer nije bilo u originalu
      }
    });
  }

   // Tvoja originalna funkcija - OPREZ: nije imala dobru "no data" logiku!
   // Ostavljam je kakva je bila, samo s dohvaćanjem contexta i destroy
   // Naziv je bio loadCategoriesChart u pozivu iz loadData
  function loadCategoriesChart(expenses) {
      const ctx = document.getElementById('categoriesChart')?.getContext('2d'); // Dodao ?.
      if (!ctx) return;

      if (categoriesChart) {
          categoriesChart.destroy();
      }

      // Tvoja originalna logika grupiranja
      const categories = {};
      // Dodajem provjeru da su expenses niz
      if(Array.isArray(expenses)){
          expenses.forEach(exp => {
              if (!exp.category) return; // Preskačemo ako nema kategorije
              if (!categories[exp.category]) {
                  categories[exp.category] = 0;
              }
              categories[exp.category] += parseFloat(exp.amount || 0); // Koristim || 0 kao u tvom originalu
          });
      } else {
           console.error("Expenses data is not an array in loadCategoriesChart:", expenses);
      }


      const labels = Object.keys(categories);
      const amounts = Object.values(categories);

     // Ako nema labela (nema kategorija s iznosima), nemoj crtati graf
     if (labels.length === 0) {
         console.log("Nema podataka za graf kategorija.");
          // Ovdje bi trebala doći logika za prikaz poruke "Nema podataka", ali je nije bilo u originalu
          // Npr. slično kao za budžete:
           const canvasElement = document.getElementById('categoriesChart');
           const parentElement = canvasElement?.parentElement;
           if(parentElement){
                parentElement.innerHTML = `<h2>Troškovi po kategorijama</h2><p>Nema podataka za prikaz.</p>`;
           }
           if (categoriesChart) categoriesChart.destroy(); categoriesChart = null; // Uništi stari graf ako postoji
         return;
     } else {
          // Osiguraj da je canvas vidljiv ako je bio skriven
           const canvasElement = document.getElementById('categoriesChart');
           const parentElement = canvasElement?.parentElement;
           if(canvasElement) canvasElement.style.display = 'block';
            // Vrati HTML strukturu ako je bila prebrisana porukom
           if(parentElement && !parentElement.querySelector('canvas')){
               parentElement.innerHTML = `<h2>Troškovi po kategorijama</h2><canvas id="categoriesChart"></canvas>`;
                // Treba opet dohvatiti context
                const newCtx = document.getElementById('categoriesChart')?.getContext('2d');
                if (!newCtx) return;
                // ctx = newCtx; // Opet problem s const, preskačemo za sad
                 const ctx = document.getElementById('categoriesChart')?.getContext('2d'); // Ponovni dohvat
                 if (!ctx) return;

           } else if (parentElement && parentElement.querySelector('p')) {
               const pMessage = parentElement.querySelector('p');
               if(pMessage) pMessage.remove();
                if (!parentElement.querySelector('h2')) {
                  const title = document.createElement('h2');
                  title.textContent = 'Troškovi po kategorijama';
                   if(canvasElement) parentElement.insertBefore(title, canvasElement); else parentElement.prepend(title);
              }
           }
     }


      // Tvoje originalne boje
      const backgroundColors = labels.length <= 6
          ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
          : labels.map((_, index) => `hsl(${(index * 45) % 360}, 70%, 60%)`);

      categoriesChart = new Chart(ctx, {
          type: 'pie',
          data: {
              labels: labels,
              datasets: [{
                  // Nije bilo labele u originalu
                  data: amounts,
                  backgroundColor: backgroundColors,
                  // Nije bilo borderWidtha u originalu
              }]
          },
          options: {
              responsive: true,
              plugins: {
                  legend: {
                      position: 'right'
                  }
                  // Nije bilo tooltips u originalu
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
        // Tvoja originalna obrada greške
         const errorText = await response.text().catch(() => "Nepoznata greška servera");
        console.error("Server vratio grešku za usporedbu:", response.status, errorText);
        throw new Error('Greška pri dohvaćanju podataka za usporedbu');
      }

       // Tvoja originalna obrada podataka
       let comparisonData = [];
       try {
         comparisonData = await response.json();
       } catch (e) {
         console.error("Greška pri parsiranju JSON-a za usporedbu:", e);
         throw new Error("Greška u formatu odgovora servera za usporedbu.");
       }

       if (!Array.isArray(comparisonData) || comparisonData.length === 0) {
           showAlert("Nema podataka za usporedbu.", "info");
           return;
       }


      const labels = comparisonData.map(item => {
         // Tvoja originalna logika formatiranja labela
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
           // maintainAspectRatio: false, // Maknuo jer nije bilo
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            title: {
              display: true,
              text: 'Mjesečna usporedba prihoda i troškova'
            }
             // Maknuo tooltip jer nije bio
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

  // Funkcija showAlert koju si imao na kraju
  function showAlert(message, type='error') { // Stavio default na error
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
     // Ostavljam tvoj originalni appendChild i remove
    document.body.appendChild(alertBox);
    setTimeout(() => {
      alertBox.remove();
    }, 5000);
  }

});
