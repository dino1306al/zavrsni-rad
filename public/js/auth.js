// Provjeri je li korisnik prijavljen
function checkAuth() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    if (!token || !userId) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
  
  // Odjavi korisnika
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
  }
  
  // Dohvati auth header za fetch zahtjeve
  function getAuthHeader() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  // Prikazi korisniku obavijest
  function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.body.prepend(alertDiv);
    
    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }