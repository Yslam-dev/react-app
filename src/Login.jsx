import React, { useState } from 'react';
import axios from 'axios';
import './css/login.css';

// API URL-i .env faýlyndan alýar.
const API_URL = import.meta.env.VITE_API_URL;

/**
 * Giriş (Login) komponenti.
 * @param {function} onLogin - Üstünlikli girişden soň çagyryljak funksiýa.
 */
function Login({ onLogin }) {
    // ⬇️ State-ler: Ulanyjy maglumatlaryny saklamak üçin.
    const [role, setRole] = useState('');
    const [username, setUsername] = useState('');
    const [surname, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [group_number, setGroup] = useState('');
    const [status, setStatus] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // ❗️ Täze: Düwme üçin GÖNI CSS (Inline Style)
    // Düwme indi inputyň aşagynda bolany üçin, position: 'absolute' gerek däl.
    const togglePasswordStyle = {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6b7280',      // Reňki
        cursor: 'pointer',
        padding: '1px 0',      // Ýokarsynda we aşagynda azajyk boşluk
        fontSize: '14px',      // Tekstiň ululygy
        textAlign: 'left',     // Sol tarapa deňlemek
        width: '100%',         // Bütün giňligi eýelemek
        display: 'block',      // Blok element etmek
        marginBottom: '2px'   // Aşagynda biraz boşluk goýmak
    };

    /**
     * Rol üýtgedilende beýleki meýdanlary arassalaýar.
     * @param {string} newRole - Täze rol ('student' ýa-da 'teacher').
     */
    const handleRoleChange = (newRole) => {
        setRole(newRole);
        setUsername('');
        setLastName('');
        setPassword('');
        setGroup('');
        setStatus('');
    };

    /**
     * Paroly görkezmek/gizlemek funksiýasy.
     */
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    /**
     * Giriş amallaryny dolandyrýan esasy funksiýa.
     */
    const handleLogin = async () => {
        // Boş meýdanlary barlamak
        if (!role || !username || !surname || !password || (role === 'student' && !group_number)) {
            setStatus('Boş ýerleri dolduryň!');
            return;
        }

        try {
            // 1. JWT Token almak üçin serwere çagyryş
            const tokenRes = await axios.post(`${API_URL}/api/token/`, {
                username,
                surname,
                password,
            });

            const { access, refresh } = tokenRes.data;
            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);

            const axiosConfig = {
                headers: { Authorization: `Bearer ${access}` },
            };

            // 2. Ulanyjynyň maglumatlaryny almak
            const userRes = await axios.get(`${API_URL}/api/user/`, axiosConfig);
            const foundUser = userRes.data;

            // 3. Alnan ulanyjy maglumatlaryny (Rol, Familiýa, Topar) barlamak
            if (
                foundUser.role === role &&
                foundUser.surname === surname &&
                (role === 'teacher' || foundUser.group_number === group_number)
            ) {
                // Mugallym adyny ýatda saklamak
                if (foundUser.role === 'teacher') {
                    localStorage.setItem("mugallymName", foundUser.username || foundUser.name);
                    localStorage.setItem("mugallymSurname", foundUser.surname);
                }

                setStatus('Giriş üstünlikli amala aşyryldy!');
                onLogin(foundUser, role);
            } else {
                setStatus('Ulanyjy maglumatlary ýalňyş ýa-da rol dogry däl!');
            }
        } catch (error) {
            console.error('Girişde näsazlyk boldy:', error.response?.data || error.message);

            if (error.response && error.response.status === 401) {
                setStatus('Ulanyjy ady, familiýasy ýa-da parol ýalňyş!');
            } else {
                setStatus('Serwer bilen baglanyşyk ýalňyş!');
            }
        }
    };

    // ⬇️ Komponentiň Görünşi (Render)
    return (
        <div className="page-container">
            <div className="login-box">
                <div className="logo">
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
                        alt="School Logo"
                    />
                </div>
                {/* Rol düwmeleri */}
                <div className="role-buttons">
                    <button
                        className={`role-button ${role === 'student' ? 'active' : ''}`}
                        onClick={() => handleRoleChange('student')}
                    >
                        Talyp
                    </button>
                    <button
                        className={`role-button ${role === 'teacher' ? 'active' : ''}`}
                        onClick={() => handleRoleChange('teacher')}
                    >
                        Mugallym
                    </button>
                </div>

                {/* Giriş meýdanlary */}
                {role && (
                    <div className="inputs">
                        <div className="input-group">
                            <label className={username ? 'filled' : ''}>Ady</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className={surname ? 'filled' : ''}>Familiýasy</label>
                            <input
                                type="text"
                                value={surname}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                        </div>

                        {/* 🔑 PAROL MEÝDANÇASY */}
                        <div className="input-group">
                            <label className={password ? 'filled' : ''}>Parol</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {/* ❗️ PAROLY GÖRKZE/GIZLE DÜWMESI (indi parol inputynyň aşagynda) */}
                        <button
                            type="button"
                            className="toggle-password-button"
                            onClick={togglePasswordVisibility}
                            style={togglePasswordStyle} // 👈 Täze GÖNI CSS berildi
                            aria-label={showPassword ? 'Paroly gizle' : 'Paroly görkez'}
                        >
                            {/* Has gowja görünmek üçin tekst we simwol */}
                            {showPassword ? '👁️ Paroly Gizle' : '🔒 Paroly Görkez'}
                        </button>


                        {role === 'student' && (
                            <div className="input-group">
                                <label className={group_number ? 'filled' : ''}>Topar</label>
                                <input
                                    type="text"
                                    value={group_number}
                                    onChange={(e) => setGroup(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <button className="login-button" onClick={handleLogin}>
                            Giriş et
                        </button>
                    </div>
                )}
                {/* Status habary */}
                {status && <p className="status-message">{status}</p>}
            </div>
        </div>
    );
}

export default Login;