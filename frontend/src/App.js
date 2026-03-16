import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import logo from './logo.png';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [settings, setSettings] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => {});
  }, []);

  const updateCountdown = useCallback(() => {
    if (!settings?.deadline) return;
    const now = new Date();
    const deadline = new Date(settings.deadline);
    const diff = Math.max(0, deadline - now);

    setCountdown({
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      mins: Math.floor((diff / (1000 * 60)) % 60),
      secs: Math.floor((diff / 1000) % 60),
    });
  }, [settings]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const pad = (n) => String(n).padStart(2, '0');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setSubscribeStatus(null);
    try {
      const res = await fetch(`${API_BASE}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubscribeStatus({ type: 'success', message: 'Check your inbox to confirm your email!' });
        setEmail('');
      } else {
        setSubscribeStatus({ type: 'error', message: data.error });
      }
    } catch {
      setSubscribeStatus({ type: 'error', message: 'Connection error' });
    }
  };

  return (
    <div className="app">
      {/* Background Video */}
      <video className="bg-video" autoPlay muted loop playsInline>
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="bg-overlay"></div>

      {/* Main Section */}
      <section className="hero">
        <div className="hero-content">
          {/* Logo */}
          <div className="logo">
            <img src={logo} alt="Logo" className="logo-img" />
          </div>

          {/* Drop Info */}
          <p className="drop-title">{settings?.drop_title || 'LOADING...'}</p>
          <p className="early-access">{settings?.early_access_text || ''}</p>

          {/* Countdown + Subscribe */}
          <div className="countdown-subscribe-wrapper">
            <div className="countdown">
              <div className="countdown-item">
                <span className="countdown-number">{pad(countdown.days)}</span>
                <span className="countdown-label">DAYS</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-item">
                <span className="countdown-number">{pad(countdown.hours)}</span>
                <span className="countdown-label">HOURS</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-item">
                <span className="countdown-number">{pad(countdown.mins)}</span>
                <span className="countdown-label">MIN</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-item">
                <span className="countdown-number">{pad(countdown.secs)}</span>
                <span className="countdown-label">SEC</span>
              </div>
            </div>

            <form onSubmit={handleSubscribe} className="subscribe-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="subscribe-input"
                required
              />
              <button type="submit" className="subscribe-btn">NOTIFY ME</button>
            </form>
            <p className={`subscribe-status ${subscribeStatus ? `subscribe-status-${subscribeStatus.type}` : 'subscribe-status-hidden'}`}>
              {subscribeStatus ? subscribeStatus.message : '\u00A0'}
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}

export default App;
