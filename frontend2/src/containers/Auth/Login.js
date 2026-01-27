import React, { useState } from "react";
import "../../assets/styles/Login.scss";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const Login = () => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [errMessage, setErrMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Get the page user was trying to visit
  const from = location.state?.from?.pathname || "/";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    setErrMessage("");
    setLoading(true);
    
    try {
      const { email, password } = credentials;
      console.log('Login component: Attempting login with email:', email);
      
      const result = await login(email, password);
      console.log('Login component: Login result:', result);
      
      if (result.success) {
        console.log("Login successful");
        // Navigate to the page they were trying to visit or home
        navigate(from, { replace: true });
      } else {
        console.log('Login component: Login failed, error:', result.message);
        setErrMessage(result.message || "Login failed");
      }
    } catch (e) {
      console.error('Login component: Login error:', e);
      setErrMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="login-background">
      <div className="login-container">
        <div className="login-content row">
          <div className="col-12 text-center">Login</div>

          <div className="col-12 form-group">
            <label>Email:</label>
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="Enter your email"
              value={credentials.email}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
          </div>

          <div className="col-12 form-group">
            <label>Password: </label>
            <input
              type="password"
              name="password"
              className="form-control"
              placeholder="Enter your password"
              value={credentials.password}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
          </div>

          {errMessage && (
            <div className="col-12" style={{ color: "red" }}>
              {errMessage}
            </div>
          )}

          <div className="col-12">
            <button 
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>

          <div className="col-12">
            <Link to="/register">
              <button disabled={loading}>Create Account</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
