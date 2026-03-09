import React, { useState } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [username, setUsername] = useState(localStorage.getItem('admin_username') || '');

  const handleLogin = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    setToken(null);
    setUsername('');
  };

  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <AdminDashboard
      token={token}
      username={username}
      onLogout={handleLogout}
    />
  );
}

export default App;
