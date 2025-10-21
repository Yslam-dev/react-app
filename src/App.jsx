import React, { useState } from 'react';
import './App.css';

import Login from './Login';
import './css/login.css';

import MugallymApp from './Mugallym';
import OkuwcyApp from './okuwcy';
import './css/BasSahypa.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null);

  // Login bolanda
  const handleLogin = (user, selectedRole) => {
  if (!user.surname || user.surname.trim() === "") {
    alert("Familiýa hökman doldurylmaly!");
    return;
  }

  // ❗ Сохраняем токены
  if (user.access) localStorage.setItem("access", user.access);
  if (user.refresh) localStorage.setItem("refresh", user.refresh);

  setIsLoggedIn(true);
  setRole(selectedRole);

  if (selectedRole === 'student') {
    localStorage.setItem("studentId", user.id);
    localStorage.setItem("studentName", user.username);
    localStorage.setItem("studentSurname", user.surname);
    localStorage.setItem("studentGroup", user.group_number);
  } else if (selectedRole === 'teacher') {
    localStorage.setItem("mugallymId", user.id);
    localStorage.setItem("mugallymName", user.username);
    localStorage.setItem("mugallymSurname", user.surname);
  }
};

  // Logout bolanda
  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole(null);
    localStorage.clear();
  };

  return (
    <div className="App">
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        role === 'student' ? (
          <OkuwcyApp
            onBack={handleLogout}
            studentInfo={{
              id: localStorage.getItem("studentId"),
              group: localStorage.getItem("studentGroup"),
              name: localStorage.getItem("studentName"),
              surname: localStorage.getItem("studentSurname"),
            }}
          />
        ) : (
          <MugallymApp
            onBack={handleLogout}
            mugallymInfo={{
              id: localStorage.getItem("mugallymId"),
              name: localStorage.getItem("mugallymName"),
              surname: localStorage.getItem("mugallymSurname"),
            }}
          />
        )
      )}
    </div>
  );
}

export default App;
