document.addEventListener('DOMContentLoaded', async () => {
  // Pretpostavka da checkAuth() i getAuthHeader() dolaze iz auth.js
  // Osiguraj da su auth funkcije dostupne prije poziva
  if (typeof checkAuth !== 'function' || typeof getAuthHeader !== 'function') {
      console.error("Auth funkcije (checkAuth, getAuthHeader) nisu dostupne!");
      alert("Greška u inicijalizaciji aplikacije. Provjerite konzolu.");
      // Možda preusmjeriti na login ili prikazati poruku
      document.body.innerHTML = "<h1>Greška aplikacije</h1><p>Potrebne skripte nisu učitane.</p>";
      return;
  }

  if (!checkAuth()) return;

  let financeChart = null;
  let budgetChart = null;
  let categoriesChart = null;
  let comparisonChart = null;

  // Inicijalizacija datuma - ovo je samo početna točka
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth(); // 0-11
  let currentYear = currentDate.getFullYear();

  let previousMonthData = { income: 0, expenses: 0, balance: 0 };
  let availableMonths = []; // Popis dostupnih mjeseci (YYYY-MM)
  let currentMonthIndex = -1; // Index trenutno prikazanog mjeseca u availableMonths

  try {
    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('welcomeMessage').textContent = `Dobrodošli, ${username}!`;
    } else {
        document.getElementById('welcomeMessage').textContent = `Dobrodošli!`; // Fallback
    }

    await loadAvailableMonths(); // Prvo učitaj dostupne mjesece

    if (availableMonths.length > 0) {
        // Pokušaj pronaći TEKUĆI kalendarski mjesec u dostupnima
        const currentRealMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        currentMonthIndex = availableMonths.indexOf(currentRealMonthStr);

        if (currentMonthIndex === -1) {
            // Ako tekući kalendarski mjesec nema podataka, prikaži najnoviji dostupni
            currentMonthIndex = 0; // Jer sortiramo DESC
        }
        // Postavi currentYear i currentMonth prema odabranom indexu
        const [year, month] = availableMonths[currentMonthIndex].split('-');
        currentYear = parseInt(year);
        currentMonth = parseInt(month) - 1; // Jer su mjeseci 0-11
    } else {
        // Nema dostupnih mjeseci, koristi trenutni kalendarski kao default
        console.warn("Nema dostupnih mjeseci s podacima.");
        // currentYear i currentMonth su već postavljeni na današnji datum
    }

    await loadData(); // Učitaj podatke za (sada ispravno) odabrani mjesec
    updateNavigationButtons(); // Ažuriraj gumbe navigacije

  } catch (error) {
    console.error('Greška tijekom inicijalizacije dashboarda:', error);
    showAlert(`Greška pri inicijalizaciji: ${error.message}`, 'error');
    // Provjera za auth greške
    if (error instanceof Response && error.status === 401) {
         console.log("Neautoriziran pristup, preusmjeravam na prijavu.");
         logout(); // Koristi postojeću logout funkciju
    } else if (typeof error.message === 'string' && (error.message.includes('token') || error.message.includes('401'))) {
        console.log("Greška vezana uz token, preusmjeravam na prijavu.");
        logout();
    }
  }

  // Funkcija za promjenu mjeseca
  window.changeMonth = async function(offset) { // Dodaj async jer loadData je async
    if (availableMonths.length === 0) return; // Nema smisla mijenjati ako nema mjeseci

    const newIndex = currentMonthIndex + offset;

    // Provjeri granice indeksa
    if (newIndex < 0 || newIndex >= availableMonths.length) {
        console.log("Dosegnuta granica dostupnih mjeseci.");
        return; // Ne radi ništa ako smo izvan granica
    }

    currentMonthIndex = newIndex;
    const [year, month] = availableMonths[currentMonthIndex].split('-');
    currentYear = parseInt(year);
    currentMonth = parseInt(month) - 1;

    // Onemogući gumbe dok se podaci učitavaju da spriječiš duple klikove
    disableNavigationButtons(true);
    try {
        await loadData(); // Učitaj podatke za novi mjesec
    } catch (error) {
        // Greška je već obrađena unutar loadData, ali možemo dodati info
        console.error("Greška prilikom učitavanja podataka za novi mjesec.");
    } finally {
         updateNavigationButtons(); // Ponovno omogući/onemogući gumbe prema novom stanju
         disableNavigationButtons(false); // Uvijek omogući nakon završetka
    }
  };

  // Funkcija za ažuriranje stanja gumba za navigaciju mjeseci
  function updateNavigationButtons() {
    const prevButton = document.querySelector('.month-selector button:first-child');
    const nextButton = document.querySelector('.month-selector button:last-child');

    if (!prevButton || !nextButton) return;

    if (availableMonths.length <= 1) {
      // Onemogući oba ako nema ili je samo jedan mjesec
      prevButton.disabled = true;
      nextButton.disabled = true;
    } else {
      // Omogući/onemogući na temelju trenutnog indeksa (0 je najnoviji zbog DESC sorta)
      prevButton.disabled = currentMonthIndex === 0; // Onemogući "Prethodni" ako smo na najnovijem
      nextButton.disabled = currentMonthIndex === availableMonths.length - 1; // Onemogući "Sljedeći" ako smo na najstarijem
    }

    // Dodaj vizualni stil za onemogućene gumbe
    prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
    prevButton.style.cursor = prevButton.disabled ? 'not-allowed' : 'pointer';
    nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
    nextButton.style.cursor = nextButton.disabled ? 'not-allowed' : 'pointer';
  }
    // Pomoćna funkcija za brzo onemogućavanje/omogućavanje gumba
  function disableNavigationButtons(disable) {
       const prevButton = document.querySelector('.month-selector button:first-child');
       const nextButton = document.querySelector('.month-selector button:last-child');
       if(prevButton) prevButton.disabled = disable;
       if(nextButton) nextButton.disabled = disable;
  }


  // Funkcija za dohvaćanje dostupnih mjeseci s podacima
  async function loadAvailableMonths() {
    try {
      const response = await fetch(`/income/transactions/months?user_id=${localStorage.getItem('userId')}`, {
        headers: getAuthHeader()
      });

      if (!response.ok) {
          if (response.status === 401) throw response; // Baci cijeli response za bolju obradu greške
          const errorData = await response.json().catch(() => ({ message: 'Nepoznata greška servera kod dohvaćanja mjeseci.' }));
          throw new Error(errorData.message || `Greška ${response.status} kod dohvaćanja mjeseci.`);
      }

      availableMonths = await response.json();

      if (!Array.isArray(availableMonths)) {
          console.error("Odgovor za dostupne mjesece nije niz:", availableMonths);
          availableMonths = []; // Resetiraj na prazan niz u slučaju greške
          throw new Error("Neočekivani format odgovora za dostupne mjesece.");
      }

      // Sortiraj mjesece od najnovijeg prema najstarijem (DESC)
      availableMonths.sort((a, b) => b.localeCompare(a));

      console.log("Dostupni mjeseci (sortirani DESC):", availableMonths);

    } catch (error) {
      console.error('Greška u loadAvailableMonths:', error);
      availableMonths = []; // Osiguraj da je prazan niz ako dođe do greške
      // Ne bacamo grešku dalje nužno, možemo nastaviti s praznom listom
      showAlert(`Nije moguće dohvatiti popis mjeseci: ${error.message || 'Nepoznata greška.'}`, 'warning');
        if (error instanceof Response && error.status === 401) throw error; // Ponovno baci 401 grešku za globalnu obradu
    }
  }

  // Glavna funkcija za učitavanje svih podataka za odabrani mjesec
  async function loadData() {
      updateMonthDisplay(); // Ažuriraj prikaz mjeseca na stranici
      const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`; // Format YYYY-MM
      const previousMonthStr = getPreviousMonthString(); // Dohvati string prethodnog mjeseca

      console.log(`Učitavam podatke za: ${monthString} (Prethodni: ${previousMonthStr})`);

      // Resetiraj kontejnere grafova na početno stanje (ako postoje poruke o grešci/nema podataka)
      resetChartContainer('financeChart', 'Financijski pregled');
      resetChartContainer('budgetChart', 'Pregled budžeta');
      resetChartContainer('categoriesChart', 'Troškovi po kategorijama');


      try {
          const userId = localStorage.getItem('userId');
          const authHeader = getAuthHeader();

          // Paralelno dohvaćanje svih potrebnih podataka
          const [incomesRes, expensesRes, budgetsRes, prevMonthRes] = await Promise.all([
              fetch(`/income?user_id=${userId}&month=${monthString}`, { headers: authHeader }).catch(err => err), // Hvataj mrežne greške odmah
              fetch(`/expenses?user_id=${userId}&month=${monthString}`, { headers: authHeader }).catch(err => err),
              fetch(`/budgets?user_id=${userId}&month=${monthString}`, { headers: authHeader }).catch(err => err), // *** Ovdje se šalje ispravan mjesec ***
              fetch(`/income/summary?user_id=${userId}&month=${previousMonthStr}`, { headers: authHeader }).catch(err => err)
          ]);

           // Provjera odgovora za svaki zahtjev
          if (incomesRes instanceof Error || !incomesRes.ok) throw await handleErrorResponse(incomesRes, 'prihoda');
          if (expensesRes instanceof Error || !expensesRes.ok) throw await handleErrorResponse(expensesRes, 'troškova');
          if (budgetsRes instanceof Error || !budgetsRes.ok) {
               // Za budžete možemo biti tolerantniji ako ih nema
               console.warn(`Greška pri dohvaćanju budžeta: ${budgetsRes.status || budgetsRes.message}. Nastavljam bez budžeta.`);
               // throw await handleErrorResponse(budgetsRes, 'budžeta'); // Odkomentiraj ako je greška kritična
          }
          if (prevMonthRes instanceof Error || !prevMonthRes.ok) {
              console.warn(`Greška pri dohvaćanju sažetka prethodnog mjeseca: ${prevMonthRes.status || prevMonthRes.message}. Nastavljam bez usporedbe.`);
              // throw await handleErrorResponse(prevMonthRes, 'sažetka prethodnog mjeseca'); // Odkomentiraj ako je kritično
          }

          // Parsiranje JSON podataka
          const incomes = await incomesRes.json();
          const expenses = await expensesRes.json();
          // Ako je dohvat budžeta bio neuspješan, budgets će biti prazan niz
          const budgets = (budgetsRes instanceof Error || !budgetsRes.ok) ? [] : await budgetsRes.json();
          // Ako je dohvat sažetka bio neuspješan, previousMonthData ostaje default
          previousMonthData = (prevMonthRes instanceof Error || !prevMonthRes.ok) ? { income: 0, expenses: 0, balance: 0 } : await prevMonthRes.json();


         // Provjeri jesu li podaci nizovi
         if (!Array.isArray(incomes)) throw new Error("Format prihoda nije ispravan.");
         if (!Array.isArray(expenses)) throw new Error("Format troškova nije ispravan.");
         if (!Array.isArray(budgets)) {
             console.warn("Format budžeta nije ispravan, tretiram kao da nema budžeta.", budgets);
            // budgets = []; // Osiguraj da je niz ako parsiranje nije uspjelo kako treba
             // Ne bacamo grešku ovdje nužno
         }


          // Izračuni ukupnih iznosa
          const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
          const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
          const balance = totalIncome - totalExpenses;

          // Ažuriranje prikaza na karticama
          document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' €';
          document.getElementById('totalExpenses').textContent = totalExpenses.toFixed(2) + ' €';
          document.getElementById('balance').textContent = balance.toFixed(2) + ' €';

          // Ažuriranje prikaza promjene salda
          const balanceChange = balance - (parseFloat(previousMonthData.balance || 0)); // Osiguraj da je broj
          const balanceChangeElement = document.getElementById('balanceChange');
          if (balanceChangeElement) {
              if (previousMonthData.balance !== undefined) { // Pokaži samo ako imamo podatke za usporedbu
                balanceChangeElement.innerHTML = balanceChange >= 0 ?
                    `<span style="color: green;">↑ ${balanceChange.toFixed(2)} €</span> vs ${previousMonthStr}` :
                    `<span style="color: red;">↓ ${Math.abs(balanceChange).toFixed(2)} €</span> vs ${previousMonthStr}`;
              } else {
                  balanceChangeElement.innerHTML = `<small>(nema podataka za ${previousMonthStr})</small>`;
              }
          }

          // Crtanje/ažuriranje grafova
          createFinanceChart(totalIncome, totalExpenses, balance);
          // Ako backend nije filtrirao budžete po mjesecu, ovaj graf će prikazati krive (sve?) budžete
          createBudgetChart(expenses, budgets);
          createCategoriesChart(expenses); // Preimenovao sam funkciju radi jasnoće

      } catch (error) {
          console.error('Greška u loadData:', error);
          showAlert(`Greška pri učitavanju podataka za ${monthString}: ${error.message}`, 'error');
          // Ovdje također provjeri za 401/token greške ako ih handleErrorResponse nije uhvatio
          if (error instanceof Response && error.status === 401) logout();
           else if (typeof error.message === 'string' && error.message.includes('401')) logout();
          // Možda resetirati prikaz ili prikazati poruku na karticama
          document.getElementById('totalIncome').textContent = 'Greška €';
          document.getElementById('totalExpenses').textContent = 'Greška €';
          document.getElementById('balance').textContent = 'Greška €';
          document.getElementById('balanceChange').textContent = '';

           // Očisti grafove u slučaju greške
            destroyChart(financeChart); financeChart = null;
            destroyChart(budgetChart); budgetChart = null;
            destroyChart(categoriesChart); categoriesChart = null;
            showChartMessage('financeChart', 'Greška pri učitavanju podataka.');
            showChartMessage('budgetChart', 'Greška pri učitavanju podataka.');
            showChartMessage('categoriesChart', 'Greška pri učitavanju podataka.');

      }
  }

    // Pomoćna funkcija za obradu grešaka iz fetch poziva
    async function handleErrorResponse(response, context) {
        if (response instanceof Error) { // Mrežna greška
            return new Error(`Mrežna greška kod dohvaćanja ${context}: ${response.message}`);
        }
        if (response.status === 401) {
             console.error(`Neautoriziran pristup (${response.status}) kod dohvaćanja ${context}.`);
             logout(); // Odjavi korisnika odmah
             return new Error("Sesija istekla ili neispravan token."); // Vrati grešku da prekineš loadData
        }
        // Pokušaj pročitati poruku s servera
        const errorData = await response.json().catch(() => ({ message: `Nepoznata greška servera (${response.status})` }));
        return new Error(`Greška kod dohvaćanja ${context}: ${errorData.message || `Status ${response.status}`}`);
    }


  // Funkcija za dobivanje stringa prethodnog mjeseca na temelju availableMonths
  function getPreviousMonthString() {
      // Jer je availableMonths sortiran DESC (najnoviji prvi), prethodni je na index + 1
      const prevIndex = currentMonthIndex + 1;
      if (prevIndex < availableMonths.length) {
          return availableMonths[prevIndex];
      }
      // Ako smo na najstarijem dostupnom mjesecu ili nema dostupnih, vrati null ili izračunaj kalendarski?
      // Vraćanje null je sigurnije da izbjegnemo dohvaćanje nepostojećih podataka
      // return null;
       // Alternativa: izračunaj kalendarski prethodni, ali pazi ako nema podataka za taj
        const prevDate = new Date(currentYear, currentMonth - 1, 1);
        return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  }

  // Funkcija za ažuriranje prikaza naziva mjeseca i godine
  function updateMonthDisplay() {
    const monthNames = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
                      "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    const displayElement = document.getElementById('currentMonth');
    if (displayElement) {
      // Provjeri jesu li currentMonth i currentYear validni brojevi
      if (typeof currentMonth === 'number' && currentMonth >= 0 && currentMonth <= 11 && typeof currentYear === 'number') {
         displayElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
      } else {
         // Prikaz default ili poruke o grešci ako vrijednosti nisu ispravne
          displayElement.textContent = "Odaberite mjesec";
          console.error("Nevažeće vrijednosti za currentMonth ili currentYear:", currentMonth, currentYear);
      }
    }
  }

    // Pomoćna funkcija za uništavanje postojećeg grafa
    function destroyChart(chartInstance) {
        if (chartInstance) {
            chartInstance.destroy();
        }
    }

    // Pomoćna funkcija za prikaz poruke unutar kontejnera grafa
    function showChartMessage(canvasId, message) {
        const canvasElement = document.getElementById(canvasId);
        const parentElement = canvasElement?.parentElement;
        if (parentElement) {
             // Zadrži naslov ako postoji
             const titleElement = parentElement.querySelector('h2');
             const titleHtml = titleElement ? titleElement.outerHTML : '';
            parentElement.innerHTML = `${titleHtml}<p class="chart-message" style="text-align: center; padding: 20px;">${message}</p>`;
        }
    }
    // Pomoćna funkcija za resetiranje kontejnera grafa (vraća canvas)
    function resetChartContainer(canvasId, title) {
         const parentElement = document.getElementById(canvasId)?.parentElement;
         if (parentElement && !parentElement.querySelector('canvas')) {
             parentElement.innerHTML = `<h2>${title}</h2><canvas id="${canvasId}"></canvas>`;
         } else if (parentElement && parentElement.querySelector('.chart-message')) {
             // Ako postoji samo poruka, makni je i osiguraj da canvas postoji
             parentElement.querySelector('.chart-message').remove();
             if (!parentElement.querySelector('canvas')) {
                  parentElement.innerHTML = `<h2>${title}</h2><canvas id="${canvasId}"></canvas>`;
             }
         }
    }


  // --- Funkcije za crtanje grafova ---

  function createFinanceChart(totalIncome, totalExpenses, balance) {
      destroyChart(financeChart); // Uništi prethodni graf ako postoji
      const ctx = document.getElementById('financeChart')?.getContext('2d');
      if (!ctx) {
           console.error("Canvas 'financeChart' nije pronađen.");
           showChartMessage('financeChart', 'Greška: Element za crtanje nije dostupan.');
           return;
      }

       // Provjeri jesu li vrijednosti brojevi
       if (isNaN(totalIncome) || isNaN(totalExpenses) || isNaN(balance)) {
            console.error("Nevažeći podaci za financijski graf:", totalIncome, totalExpenses, balance);
            showChartMessage('financeChart', 'Nevažeći podaci za prikaz.');
            return;
       }


      financeChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: ['Prihodi', 'Troškovi', 'Saldo'],
              datasets: [{
                  label: 'Iznos (€)', // Bolji label
                  data: [totalIncome, totalExpenses, balance],
                  backgroundColor: [
                      'rgba(75, 192, 192, 0.6)',  // Zelena za prihode
                      'rgba(255, 99, 132, 0.6)',   // Crvena za troškove
                      balance >= 0 ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 159, 64, 0.6)' // Plava za pozitivan, narančasta za negativan saldo
                  ],
                  borderColor: [ // Dodajemo i border
                      'rgba(75, 192, 192, 1)',
                      'rgba(255, 99, 132, 1)',
                      balance >= 0 ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 159, 64, 1)'
                  ],
                  borderWidth: 1
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false, // Omogućava bolju kontrolu visine
              plugins: {
                   legend: { display: false }, // Sakrij legendu jer su boje dovoljne
                   title: { display: true, text: `Financijski pregled za ${document.getElementById('currentMonth').textContent}` } // Dodaj dinamički naslov
              },
              scales: {
                  y: {
                      beginAtZero: true,
                      ticks: { callback: value => `${value} €` } // Formatiranje osi
                  }
              }
          }
      });
  }

  function createBudgetChart(expenses, budgets) {
      destroyChart(budgetChart);
      const canvasElement = document.getElementById('budgetChart');
      const ctx = canvasElement?.getContext('2d');

      if (!ctx) {
          console.error("Canvas 'budgetChart' nije pronađen.");
          showChartMessage('budgetChart','Greška: Element za crtanje nije dostupan.');
          return;
      }

       // Provjeri jesu li budgets ispravan niz
       if (!Array.isArray(budgets)) {
            console.error("Nevažeći podaci za budžete (nije niz):", budgets);
            showChartMessage('budgetChart', 'Greška u podacima o budžetima.');
            return;
       }

      // Ako nema budžeta, prikaži informativnu poruku
      if (budgets.length === 0) {
          console.log("Nema postavljenih budžeta za ovaj mjesec.");
          showChartMessage('budgetChart', `Nema postavljenih budžeta za ${document.getElementById('currentMonth').textContent}. <a href="budgets.html">Postavite budžete</a>.`);
          return;
      }

      // Grupiranje troškova po kategorijama (samo za kategorije koje imaju budžet)
      const budgetCategories = budgets.map(b => b.category);
      const expensesForBudgetCategories = {};
      budgetCategories.forEach(cat => { expensesForBudgetCategories[cat] = 0; }); // Inicijaliziraj sve na 0

       // Provjeri jesu li expenses ispravan niz
       if (!Array.isArray(expenses)) {
           console.error("Nevažeći podaci za troškove (nije niz):", expenses);
            showChartMessage('budgetChart', 'Greška u podacima o troškovima.');
           return;
       }


      expenses.forEach(exp => {
          if (exp.category && expensesForBudgetCategories.hasOwnProperty(exp.category)) {
              expensesForBudgetCategories[exp.category] += parseFloat(exp.amount || 0);
          }
      });

      const labels = budgetCategories;
      const budgetAmounts = budgets.map(b => parseFloat(b.amount || 0));
      const actualAmounts = labels.map(cat => expensesForBudgetCategories[cat] || 0);

       // Provjera ispravnosti podataka prije crtanja
       if (labels.some(l => typeof l !== 'string') || budgetAmounts.some(isNaN) || actualAmounts.some(isNaN)) {
            console.error("Nevažeći podaci izračunati za graf budžeta:", { labels, budgetAmounts, actualAmounts });
            showChartMessage('budgetChart', 'Greška prilikom pripreme podataka za graf budžeta.');
            return;
       }


      budgetChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: labels,
              datasets: [
                  {
                      label: 'Budžet (€)',
                      data: budgetAmounts,
                      backgroundColor: 'rgba(54, 162, 235, 0.6)', // Plava
                      borderColor: 'rgba(54, 162, 235, 1)',
                      borderWidth: 1
                  },
                  {
                      label: 'Stvarni troškovi (€)',
                      data: actualAmounts,
                      backgroundColor: (context) => { // Dinamička boja - crvena ako premašeno
                          const index = context.dataIndex;
                          const budget = budgetAmounts[index];
                          const actual = actualAmounts[index];
                          return actual > budget ? 'rgba(255, 99, 132, 0.6)' : 'rgba(75, 192, 192, 0.6)'; // Crvena ako premašeno, inače zelena
                      },
                       borderColor: (context) => {
                          const index = context.dataIndex;
                          const budget = budgetAmounts[index];
                          const actual = actualAmounts[index];
                          return actual > budget ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)';
                      },
                      borderWidth: 1
                  }
              ]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y', // Horizontalni barovi za bolju čitljivost kategorija
              plugins: {
                   legend: { position: 'top' },
                   title: { display: true, text: `Usporedba budžeta i troškova za ${document.getElementById('currentMonth').textContent}` }
              },
              scales: {
                  x: { // Sada je X os za iznose
                      beginAtZero: true,
                      ticks: { callback: value => `${value} €` }
                  },
                  y: { // Y os za kategorije
                       ticks: { autoSkip: false } // Pokaži sve labele kategorija
                  }
              }
          }
      });
  }

  function createCategoriesChart(expenses) {
      destroyChart(categoriesChart);
      const canvasElement = document.getElementById('categoriesChart');
      const ctx = canvasElement?.getContext('2d');

      if (!ctx) {
           console.error("Canvas 'categoriesChart' nije pronađen.");
           showChartMessage('categoriesChart', 'Greška: Element za crtanje nije dostupan.');
           return;
       }

      // Provjeri jesu li expenses ispravan niz
       if (!Array.isArray(expenses)) {
           console.error("Nevažeći podaci za troškove (nije niz):", expenses);
           showChartMessage('categoriesChart', 'Greška u podacima o troškovima.');
           return;
       }


      // Grupiranje troškova po kategorijama
      const expensesByCategory = {};
      let totalExpensesSum = 0;
      expenses.forEach(exp => {
          const category = exp.category || 'Bez kategorije'; // Grupiraj nekategorizirane
          const amount = parseFloat(exp.amount || 0);
          if (isNaN(amount)) return; // Preskoči nevažeće iznose

          if (!expensesByCategory[category]) {
              expensesByCategory[category] = 0;
          }
          expensesByCategory[category] += amount;
          totalExpensesSum += amount;
      });

      const labels = Object.keys(expensesByCategory);
      const amounts = Object.values(expensesByCategory);

      // Ako nema troškova, prikaži poruku
      if (labels.length === 0 || totalExpensesSum === 0) {
          console.log("Nema troškova za prikaz u grafu kategorija.");
          showChartMessage('categoriesChart', `Nema zabilježenih troškova za ${document.getElementById('currentMonth').textContent}.`);
          return;
      }

        // Provjera ispravnosti podataka
       if (labels.some(l => typeof l !== 'string') || amounts.some(isNaN)) {
            console.error("Nevažeći podaci izračunati za graf kategorija:", { labels, amounts });
            showChartMessage('categoriesChart', 'Greška prilikom pripreme podataka za graf kategorija.');
            return;
       }

      // Generiranje boja
       const backgroundColors = labels.map((_, index) => `hsl(${(index * 60) % 360}, 70%, 60%)`); // Različite boje


      categoriesChart = new Chart(ctx, {
          type: 'doughnut', // Doughnut je često pregledniji od Pie
          data: {
              labels: labels,
              datasets: [{
                  label: 'Troškovi po kategoriji (€)',
                  data: amounts,
                  backgroundColor: backgroundColors,
                  hoverOffset: 4 // Mali efekt kod prelaska mišem
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                   legend: {
                       position: 'right', // Legenda sa strane
                       labels: {
                           // Možda dodati postotak ili iznos u legendu?
                           // generateLabels: function(chart) { ... } // Kompleksnije
                       }
                   },
                   title: {
                       display: true,
                       text: `Raspodjela troškova po kategorijama za ${document.getElementById('currentMonth').textContent}`
                   },
                   tooltip: { // Prilagođeni tooltip
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                     const value = context.parsed;
                                     const percentage = ((value / totalExpensesSum) * 100).toFixed(1);
                                     label += `${value.toFixed(2)} € (${percentage}%)`;
                                }
                                return label;
                            }
                        }
                   }
              }
          }
      });
  }

  // --- Funkcije za modal usporedbe ---

  window.showMonthlyComparison = async function() {
      const modalElement = document.getElementById('comparisonModal');
      const canvasElement = document.getElementById('comparisonChart');
       const closeButton = modalElement?.querySelector('.btn-secondary'); // Gumb za zatvaranje

       if (!modalElement || !canvasElement || !closeButton) {
            console.error("Modalni elementi za usporedbu nisu pronađeni.");
            showAlert("Greška pri otvaranju usporedbe.", "error");
            return;
       }

      // Pokaži modal i možda neki loading indikator
      modalElement.style.display = 'block';
      resetChartContainer('comparisonChart', 'Mjesečna usporedba'); // Resetiraj prije dohvaćanja
       showChartMessage('comparisonChart', 'Učitavam podatke za usporedbu...');
       closeButton.disabled = true; // Onemogući zatvaranje dok se učitava


      try {
          const response = await fetch(`/income/transactions/comparison?user_id=${localStorage.getItem('userId')}`, {
              headers: getAuthHeader()
          });

          if (!response.ok) throw await handleErrorResponse(response, 'podataka za usporedbu');

          const comparisonData = await response.json();

           if (!Array.isArray(comparisonData)) {
                 console.error("Format podataka za usporedbu nije ispravan:", comparisonData);
                 throw new Error("Neočekivani format odgovora za usporedbu.");
           }

          if (comparisonData.length === 0) {
              showAlert("Nema dovoljno podataka za mjesečnu usporedbu.", "info");
              showChartMessage('comparisonChart', 'Nema podataka za prikaz usporedbe.');
               closeButton.disabled = false; // Omogući zatvaranje
              // Ne zatvaramo modal automatski, korisnik će ga zatvoriti
              return;
          }

           // Sortiraj podatke po mjesecu ASC radi grafa
           comparisonData.sort((a, b) => (a.month || "").localeCompare(b.month || ""));


          const labels = comparisonData.map(item => {
              if (typeof item.month !== 'string' || !item.month.includes('-')) return 'N/A';
              const [year, month] = item.month.split('-');
              const monthNamesShort = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"];
              const monthIndex = parseInt(month) - 1;
               if (monthIndex >= 0 && monthIndex < 12 && year && year.length === 4) {
                   return `${monthNamesShort[monthIndex]} '${year.substring(2)}`; // Format: Sij '25
               }
               return item.month; // Fallback
          });

          const incomeData = comparisonData.map(item => parseFloat(item.income || 0));
          const expensesData = comparisonData.map(item => parseFloat(item.expenses || 0));

           // Provjeri ispravnost podataka
            if (labels.some(l => typeof l !== 'string') || incomeData.some(isNaN) || expensesData.some(isNaN)) {
                console.error("Nevažeći podaci izračunati za graf usporedbe:", { labels, incomeData, expensesData });
                throw new Error("Greška prilikom pripreme podataka za graf usporedbe.");
            }


          // Crtanje grafa usporedbe
          destroyChart(comparisonChart); // Uništi stari ako postoji
           resetChartContainer('comparisonChart', 'Mjesečna usporedba'); // Vrati canvas ako je bila poruka
           const ctx = document.getElementById('comparisonChart')?.getContext('2d'); // Dohvati context opet
           if (!ctx) throw new Error("Canvas za usporedbu nije pronađen nakon resetiranja.");


          comparisonChart = new Chart(ctx, {
              type: 'line', // Linijski graf je bolji za trendove
              data: {
                  labels: labels,
                  datasets: [
                      {
                          label: 'Prihodi (€)',
                          data: incomeData,
                          borderColor: 'rgba(75, 192, 192, 1)',
                          backgroundColor: 'rgba(75, 192, 192, 0.2)', // Boja ispod linije
                          fill: true, // Ispuni područje ispod linije
                          tension: 0.1 // Lagano zakrivljenje linije
                      },
                      {
                          label: 'Troškovi (€)',
                          data: expensesData,
                          borderColor: 'rgba(255, 99, 132, 1)',
                          backgroundColor: 'rgba(255, 99, 132, 0.2)',
                          fill: true,
                           tension: 0.1
                      }
                  ]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false, // Da popuni dostupnu visinu modala
                   plugins: {
                       legend: { position: 'top' },
                       title: { display: true, text: 'Mjesečna usporedba prihoda i troškova' }
                   },
                  scales: {
                      y: {
                           beginAtZero: true,
                           ticks: { callback: value => `${value} €` }
                      }
                  }
              }
          });

      } catch (error) {
          console.error('Greška u showMonthlyComparison:', error);
          showAlert(`Greška pri učitavanju usporedbe: ${error.message}`, 'error');
          showChartMessage('comparisonChart', `Greška: ${error.message}`); // Pokaži grešku u modalu
           if (error.message.includes("token")) logout(); // Odjavi ako je token problem
      } finally {
           closeButton.disabled = false; // Uvijek omogući gumb za zatvaranje na kraju
      }
  };

  window.hideComparisonModal = function() {
      const modalElement = document.getElementById('comparisonModal');
      if (modalElement) {
          modalElement.style.display = 'none';
          destroyChart(comparisonChart); // Uništi graf kad se modal zatvori
          comparisonChart = null;
           resetChartContainer('comparisonChart', 'Mjesečna usporedba'); // Vrati u početno stanje
      }
  };

  // Funkcija za prikaz obavijesti (alert)
  function showAlert(message, type = 'error') { // default je error
      // Izbjegavaj duple alertove iste poruke? Opcionalno.
      const existingAlerts = document.querySelectorAll('.alert-dynamic');
       for (let alert of existingAlerts) {
           if (alert.textContent === message) return; // Ne prikazuj isti alert ponovno
       }


      const alertBox = document.createElement('div');
      // Koristi klase koje možda već imaš definirane (npr. iz Bootstrapa) ili definiraj stilove
      alertBox.className = `alert-dynamic alert-${type}`; // npr. alert-error, alert-success, alert-info
      alertBox.textContent = message;
      alertBox.style.position = 'fixed';
      alertBox.style.top = '20px';
      alertBox.style.right = '20px';
      alertBox.style.padding = '15px';
      alertBox.style.borderRadius = '5px';
      alertBox.style.color = 'white';
      alertBox.style.zIndex = '2000'; // Iznad svega ostalog
      alertBox.style.minWidth = '200px';
      alertBox.style.maxWidth = '400px';
      alertBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

       switch (type) {
           case 'success': alertBox.style.backgroundColor = '#28a745'; break;
           case 'info': alertBox.style.backgroundColor = '#17a2b8'; break;
           case 'warning': alertBox.style.backgroundColor = '#ffc107'; alertBox.style.color = '#333'; break;
           case 'error':
           default: alertBox.style.backgroundColor = '#dc3545'; break;
       }


      document.body.appendChild(alertBox);

      // Ukloni nakon nekog vremena
      setTimeout(() => {
          alertBox.style.opacity = '0';
          alertBox.style.transition = 'opacity 0.5s ease-out';
          setTimeout(() => alertBox.remove(), 500); // Ukloni iz DOM-a nakon fade-outa
      }, 5000); // Prikazuj 5 sekundi

       // Dodaj gumb za ručno zatvaranje
       const closeBtn = document.createElement('button');
       closeBtn.textContent = '×'; // 'X' simbol
       closeBtn.style.position = 'absolute';
       closeBtn.style.top = '5px';
       closeBtn.style.right = '10px';
       closeBtn.style.background = 'none';
       closeBtn.style.border = 'none';
       closeBtn.style.color = 'inherit'; // Naslijedi boju teksta
       closeBtn.style.fontSize = '1.2em';
       closeBtn.style.cursor = 'pointer';
       closeBtn.onclick = () => alertBox.remove();
       alertBox.appendChild(closeBtn);


  }
  // Funkcija za odjavu (premještena iz HTML-a radi bolje organizacije)
  window.logout = function() {
      localStorage.clear(); // Očisti sve podatke iz lokalne pohrane
      window.location.href = 'index.html'; // Preusmjeri na stranicu za prijavu
  };


}); // Kraj DOMContentLoaded
