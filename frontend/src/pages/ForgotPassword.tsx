import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { Input } from '../components/Input';
import Button from '../components/Button';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="logo-large">
            <div className="logo-circle">S</div>
            <span>shareIT</span>
          </div>
          <h1>Check Your Email</h1>
          <p>If the email exists, a password reset email has been sent.</p>
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-large">
          <div className="logo-circle">S</div>
          <span>shareIT</span>
        </div>
        <h1>Forgot Password</h1>
        <form onSubmit={handleSubmit}>
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <div className="error-message">{error}</div>}
          <Button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Sending...' : 'Reset Password'}
          </Button>
        </form>
        <div className="auth-links">
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

