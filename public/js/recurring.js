class RecurringManager {
  static async generateRecurringItems() {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      if (!token || !userId) return;
      
      // Dohvati sve aktivne ponavljajuće stavke
      const [expensesRes, incomeRes] = await Promise.all([
        fetch(`http://localhost:3000/expenses/recurring?user_id=${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:3000/income/recurring?user_id=${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (!expensesRes.ok || !incomeRes.ok) return;
      
      const expenses = await expensesRes.json();
      const income = await incomeRes.json();
      
      // Generiraj nove stavke za ovaj mjesec
      await this.generateItems(expenses, 'expense');
      await this.generateItems(income, 'income');
    } catch (error) {
      console.error('Error generating recurring items:', error);
    }
  }
  
  static async generateItems(items, type) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    for (const item of items) {
      const lastGeneratedDate = new Date(item.date);
      
      if (this.shouldGenerateItem(item, lastGeneratedDate, currentMonth, currentYear)) {
        await this.createNewItem(item, type, currentDate);
      }
    }
  }
  
  static shouldGenerateItem(item, lastGeneratedDate, currentMonth, currentYear) {
    const interval = item.recurrence_interval;
    const endDate = item.recurrence_end_date ? new Date(item.recurrence_end_date) : null;
    
    if (endDate && endDate < new Date()) {
      return false;
    }
    
    switch (interval) {
      case 'monthly':
        return lastGeneratedDate.getMonth() < currentMonth || 
               lastGeneratedDate.getFullYear() < currentYear;
      case 'yearly':
        return lastGeneratedDate.getFullYear() < currentYear;
      case 'weekly':
        const weeksDiff = Math.floor((new Date() - lastGeneratedDate) / (7 * 24 * 60 * 60 * 1000));
        return weeksDiff >= 1;
      case 'daily':
        return lastGeneratedDate.toDateString() !== new Date().toDateString();
      default:
        return false;
    }
  }
  
  static async createNewItem(item, type, currentDate) {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const newDate = new Date(currentDate);
      
      // Postavi na prvi dan u mjesecu za mjesečno ponavljanje
      if (item.recurrence_interval === 'monthly') {
        newDate.setDate(1);
      }
      
      const url = type === 'expense' 
        ? 'http://localhost:3000/expenses' 
        : 'http://localhost:3000/income';
      
      const body = {
        user_id: userId,
        amount: item.amount,
        description: item.description,
        date: newDate.toISOString().split('T')[0],
        is_recurring: false
      };
      
      if (type === 'expense') {
        body.category = item.category;
      }
      
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      // Ažuriraj datum zadnjeg generiranja u originalnoj stavci
      await fetch(
        type === 'expense' 
          ? `http://localhost:3000/expenses/${item.id}` 
          : `http://localhost:3000/income/${item.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userId,
            date: newDate.toISOString().split('T')[0]
          })
        }
      );
    } catch (error) {
      console.error(`Error creating new ${type}:`, error);
    }
  }
}

// Pokreni generiranje prilikom učitavanja dashboarda
document.addEventListener('DOMContentLoaded', () => {
  RecurringManager.generateRecurringItems();
});