document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
  
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
  
    const res = await fetch('/users/register', { // <<<--- ISPRAVLJENO! Samo putanja.
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
  });
  
    const data = await res.json();
    document.getElementById('message').textContent = data.message || data.error;
  });
  