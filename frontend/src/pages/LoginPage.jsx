
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";

function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const { email, password } = formData;

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...formData, rememberMe }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not log in.");
      navigate("/");
    } catch (requestError) {
      setError(requestError.message || "Could not connect to the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="register-header">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="/#top">Home</a>
          <a href="/#shops">Find Repair Shops</a>
          <a href="/#search">Repair Request</a>
          <a href="/#about">About Us</a>
        </nav>
        <div className="register-header-actions">
          <a className="register-emergency" href="tel:119">⚠ Emergency Service</a>
          <Link className="register-login" to="/register">Sign Up</Link>
        </div>
      </header>

      <main className="auth-container">

        {/* Welcome Section */}
        <section className="auth-welcome">
          <Logo light />
          <h1>Welcome Back!</h1>

          <p>
            Your home deserves the best care.
            Log in to HomeFix and connect with
            trusted repair professionals.
          </p>

          <div className="auth-testimonial">
            "HomeFix makes finding reliable home
            repair services simple and convenient!"
          </div>
        </section>

        {/* Login Form */}
        <section className="auth-form-section">
          <div className="auth-form-card">

            <h2>Welcome Back</h2>

            <p className="auth-subtitle">
              Please enter your details to log in.
            </p>

            {error && (
              <div className="auth-message" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* Email */}
              <label htmlFor="login-email">
                Email Address *
              </label>

              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />

              {/* Password */}
              <label htmlFor="login-password">
                Password *
              </label>

              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
              />

              {/* Remember Me */}
              <div className="login-options">

                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) =>
                      setRememberMe(e.target.checked)
                    }
                  />
                  Remember me
                </label>

                <a href="mailto:support@homefix.com?subject=Password%20Reset">
                  Forgot password?
                </a>

              </div>

              {/* Show Password */}
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) =>
                    setShowPassword(e.target.checked)
                  }
                />
                Show password
              </label>

              {/* Login Button */}
              <button type="submit" className="auth-submit" disabled={isSubmitting}>
                {isSubmitting ? "Logging in…" : "Log In"}
              </button>

            </form>

            <p className="auth-switch">
              Don't have an account?{" "}
              <Link to="/register">Create Account</Link>
            </p>

          </div>
        </section>

      </main>
    </div>
  );
}

export default LoginPage;
