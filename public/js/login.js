document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const messageElement = document.getElementById('message');
  
  messageElement.textContent = 'Prijavljujem...';
  messageElement.style.color = 'black';

  try {
    const res = await fetch('http://localhost:3000/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Neuspješna prijava');
    }

    // Spremi token i korisničke podatke
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('username', data.username);

    messageElement.textContent = 'Uspješna prijava! Preusmjeravanje...';
    messageElement.style.color = 'green';

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  } catch (error) {
    console.error('Greška pri prijavi:', error);
    messageElement.textContent = error.message;
    messageElement.style.color = 'red';
  }
});