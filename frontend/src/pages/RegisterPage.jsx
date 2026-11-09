
import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const { name, email, phone, password, confirmPassword } = formData;

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setMessage("Please fill in all required fields.");
      setMessageType("error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Please enter a valid email address.");
      setMessageType("error");
      return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setMessage("Password must contain at least 8 characters, including a letter and a number.");
      setMessageType("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    if (!agreeTerms) {
      setMessage("Please agree to the Terms of Service and Privacy Policy.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, phone, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not create your account.");

      setMessage(result.message || "Your account has been created.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Could not connect to the server. Please try again.");
      setMessageType("error");
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
          <Link className="register-login" to="/login">♙ Log In</Link>
        </div>
      </header>

      <main className="auth-container">
        <section className="auth-welcome">
          <Logo light />
          <h1>A little less worry. A home that works.</h1>

          <p>
            Create your customer account to book trusted repair shops
            and keep every request in one place.
          </p>

          <div className="auth-testimonial">
            <div className="testimonial-stars">★★★★★</div>
            <p>
              "I found a verified AC shop near my apartment and they
              came the same afternoon. So much easier than asking
              around on Facebook."
            </p>
            <strong>Sreyneang P.</strong>
            <small>Renter, BKK1</small>
          </div>
        </section>

        <section className="auth-form-section">
          <div className="auth-form-card">
            <h2>Create an account</h2>

            <p className="auth-subtitle">
              Already have an account? <Link to="/login">Log in</Link>
            </p>

            <h4 className="account-type">CUSTOMER ACCOUNT</h4>

            {message && (
              <div className={`auth-message ${messageType}`} role="alert">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Your full name"
                value={formData.name}
                onChange={handleChange}
              />

              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
              />

              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="e.g. 012 345 678"
                value={formData.phone}
                onChange={handleChange}
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
              />

              <small className="password-hint">
                Use at least 8 characters with a letter and a number.
              </small>

              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />

              <label className="auth-checkbox terms-checkbox">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span>
                  I agree to the <strong>Terms of Service</strong> and
                  <strong> Privacy Policy</strong>.
                </span>
              </label>

              <button type="submit" className="auth-submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create Account"}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="google-button"
              onClick={() => alert("Google login will be added later.")}
            >
              Continue with Google
            </button>

            <p className="auth-switch">
              Own a repair shop? <Link to="/shop-register">Register your shop</Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default RegisterPage;
