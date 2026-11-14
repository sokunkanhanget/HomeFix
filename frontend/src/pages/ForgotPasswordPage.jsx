import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage("Enter a valid email address to continue.");
      return;
    }

    // Frontend-only confirmation; password reset delivery will be wired to the backend later.
    setSubmitted(true);
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

      <main className="auth-container forgot-password-container">
        <section className="auth-welcome">
          <Logo light />
          <h1>Let’s get you back into your account.</h1>
          <p>Your repair requests will be here when you return. Reset your password to pick up where you left off.</p>
          <div className="auth-testimonial">
            <div className="testimonial-stars" aria-label="5 out of 5 stars">★★★★★</div>
            <p>“I found a verified AC shop near my apartment and they came the same afternoon. So much easier than asking around on Facebook.”</p>
            <div className="testimonial-person">
              <span className="testimonial-avatar" aria-hidden="true">♙</span>
              <span><strong>Sreyneang P.</strong><small>Renter, BKK1</small></span>
            </div>
          </div>
        </section>

        <section className="auth-form-section forgot-password-section">
          <div className="auth-form-card forgot-password-card">
            <div className="forgot-password-icon" aria-hidden="true">✉</div>
            <h2>{submitted ? "Check your inbox" : "Forgot your password?"}</h2>
            <p className="auth-subtitle">
              {submitted
                ? `If an account matches ${email.trim()}, you’ll receive a link to choose a new password.`
                : "Enter the email address linked to your HomeFix account to request a password reset link."}
            </p>

            {message && <div className="auth-message" role="alert">{message}</div>}

            {!submitted && (
              <form onSubmit={handleSubmit}>
                <label htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <button type="submit" className="auth-submit">Send Reset Link</button>
              </form>
            )}

            <aside className="forgot-password-note">
              <strong>{submitted ? "No email yet?" : "What happens next?"}</strong>
              <p>{submitted
                ? "Check your spam folder, or try another email address linked to your account."
                : "If an account matches this email, you’ll receive a link to choose a new password. Check your spam folder too."}</p>
            </aside>

            <Link className="forgot-back-link" to="/login">Back to Log In</Link>
            <p className="forgot-contact">Need help accessing your account? Contact <a href="mailto:hello@homefix.com.kh">hello@homefix.com.kh</a></p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ForgotPasswordPage;
