import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Home from './Home';
import CreatePost from './CreatePost';
import Login from './Login';
import SignUp from './SignUp';
import './App.css';

function App() {
    // State to store the token
    const [token, setToken] = useState(localStorage.getItem('token'));

    // Function to handle logout
    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('token');
    };

    // Effect to update localStorage when token changes
    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
        }
    }, [token]);

    return (
        <Router>
            <div className="app">
                <nav>
                    <ul>
                        <li>
                            <Link to="/">Home</Link>
                        </li>
                        <li>
                            <Link to="/create">Create Post</Link>
                        </li>
                        {token ? (
                            <li>
                                <button onClick={handleLogout}>Logout</button>
                            </li>
                        ) : (
                            <>
                                <li>
                                    <Link to="/login">Login</Link>
                                </li>
                                <li>
                                    <Link to="/signup">Sign Up</Link>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>
                <Routes>
                    {/* Route for login page */}
                    <Route path="/login" element={<Login setToken={setToken} />} />
                    {/* Route for signup page */}
                    <Route path="/signup" element={<SignUp />} />
                    {/* Route for home page, redirects to login if not authenticated */}
                    <Route path="/" element={token ? <Home token={token} /> : <Navigate to="/login" />} />
                    {/* Route for create post page, redirects to login if not authenticated */}
                    <Route path="/create" element={token ? <CreatePost token={token} /> : <Navigate to="/login" />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;