import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login({ setToken }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log('Logging in user:', { username });
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/login`, {
                username,
                password
            });
            console.log('User logged in successfully:', response.data);
            setToken(response.data.token);
            localStorage.setItem('token', response.data.token);
            navigate('/'); // Redirect to homepage
        } catch (error) {
            console.error('Error logging in:', error);
        }
    };

    return (
        <div className="login">
            <h2>Login</h2>
            <form onSubmit={onSubmit}>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;