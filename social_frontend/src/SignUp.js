import React, { useState } from 'react';
import axios from 'axios';

function SignUp() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log('Signing up user:', { username, password });
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/register`, {
                username,
                password
            });
            console.log('User registered successfully:', response.data);
        } catch (error) {
            console.error('Error signing up:', error);
        }
    };

    return (
        <div className="signup">
            <h2>Sign Up</h2>
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
                <button type="submit">Sign Up</button>
            </form>
        </div>
    );
}

export default SignUp;