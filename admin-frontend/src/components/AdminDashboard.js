import React, { useState, useEffect, useCallback } from 'react';
import './Admin.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function AdminDashboard({ token, username, onLogout }) {
  const [settings, setSettings] = useState({
    deadline: '',
    drop_title: '',
    early_access_text: '',
    bottom_title: '',
    bottom_description: '',
    collection_url: '',
    klaviyo_api_key: '',
    klaviyo_list_id: '',
  });
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('deadline');

  // Subscribers
  const [subscribers, setSubscribers] = useState([]);
  const [subscriberSearch, setSubscriberSearch] = useState('');

  // Klaviyo
  const [klaviyoTesting, setKlaviyoTesting] = useState(false);
  const [savingKlaviyo, setSavingKlaviyo] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetch(`${API_BASE}/settings/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const dt = data.deadline ? new Date(data.deadline) : new Date();
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
        setSettings({
          deadline: local.toISOString().slice(0, 16),
          drop_title: data.drop_title || '',
          early_access_text: data.early_access_text || '',
          bottom_title: data.bottom_title || '',
          bottom_description: data.bottom_description || '',
          collection_url: data.collection_url || '',
          klaviyo_api_key: data.klaviyo_api_key || '',
          klaviyo_list_id: data.klaviyo_list_id || '',
        });
      })
      .catch(() => showAlert('Failed to load settings', 'error'));
  }, [token]);

  const updateCountdown = useCallback(() => {
    if (!settings.deadline) return;
    const deadline = new Date(settings.deadline);
    const diff = Math.max(0, deadline - new Date());
    setCountdown({
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      mins: Math.floor((diff / (1000 * 60)) % 60),
      secs: Math.floor((diff / 1000) % 60),
    });
  }, [settings.deadline]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const pad = (n) => String(n).padStart(2, '0');

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        deadline: new Date(settings.deadline).toISOString(),
      };
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 401) { onLogout(); return; }
        throw new Error();
      }
      showAlert('Settings saved successfully!', 'success');
    } catch {
      showAlert('Failed to save settings', 'error');
    }
    setSaving(false);
  };

  const loadSubscribers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/subscribers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    if (activeTab === 'subscribers') {
      loadSubscribers();
    }
  }, [activeTab, loadSubscribers]);

  const deleteSubscriber = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/subscribers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSubscribers((prev) => prev.filter((s) => s.id !== id));
        showAlert('Subscriber removed', 'success');
      }
    } catch {
      showAlert('Failed to delete subscriber', 'error');
    }
  };

  const exportSubscribers = async () => {
    try {
      const res = await fetch(`${API_BASE}/subscribers/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subscribers.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showAlert('Failed to export', 'error');
    }
  };

  const filteredSubscribers = subscribers.filter((s) =>
    s.email.toLowerCase().includes(subscriberSearch.toLowerCase())
  );

  const saveKlaviyo = async () => {
    setSavingKlaviyo(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          klaviyo_api_key: settings.klaviyo_api_key,
          klaviyo_list_id: settings.klaviyo_list_id,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { onLogout(); return; }
        throw new Error();
      }
      showAlert('Klaviyo settings saved!', 'success');
    } catch {
      showAlert('Failed to save Klaviyo settings', 'error');
    }
    setSavingKlaviyo(false);
  };

  const testKlaviyo = async () => {
    setKlaviyoTesting(true);
    try {
      const res = await fetch(`${API_BASE}/settings/klaviyo-test`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(data.message, 'success');
      } else {
        showAlert(data.error, 'error');
      }
    } catch {
      showAlert('Failed to test connection', 'error');
    }
    setKlaviyoTesting(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showAlert('Passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 4) {
      showAlert('Password must be at least 4 characters', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        showAlert(data.error || 'Failed', 'error');
        return;
      }
      showAlert('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      showAlert('Failed to change password', 'error');
    }
  };

  const tabs = [
    { id: 'deadline', label: 'Countdown', icon: '⏱' },
    { id: 'content', label: 'Content', icon: '✎' },
    { id: 'subscribers', label: 'Subscribers', icon: '✉', count: subscribers.length },
    { id: 'integrations', label: 'Integrations', icon: '⚡' },
    { id: 'password', label: 'Security', icon: '⚿' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>AGITE</h2>
          <span className="admin-badge">Admin</span>
        </div>

        <nav className="admin-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="admin-nav-icon">{tab.icon}</span>
              {tab.label}
              {tab.count > 0 && <span className="admin-nav-count">{tab.count}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-avatar">{username?.charAt(0).toUpperCase()}</div>
            <span>{username}</span>
          </div>
          <button className="admin-btn-logout" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Top Alert */}
        {alert && (
          <div className={`admin-alert admin-alert-${alert.type} admin-alert-floating`}>
            {alert.message}
          </div>
        )}

        {/* Deadline Tab */}
        {activeTab === 'deadline' && (
          <div className="admin-page">
            <div className="admin-page-header">
              <h1>Countdown Timer</h1>
              <p>Set the deadline for the countdown displayed on the landing page.</p>
            </div>

            {/* Live Preview */}
            <div className="admin-card admin-preview-card">
              <div className="admin-preview-label">LIVE PREVIEW</div>
              <div className="admin-preview">
                <div className="admin-preview-countdown">
                  <div className="admin-preview-unit">
                    <span className="admin-preview-number">{pad(countdown.days)}</span>
                    <span className="admin-preview-label-text">DAYS</span>
                  </div>
                  <span className="admin-preview-sep">:</span>
                  <div className="admin-preview-unit">
                    <span className="admin-preview-number">{pad(countdown.hours)}</span>
                    <span className="admin-preview-label-text">HOURS</span>
                  </div>
                  <span className="admin-preview-sep">:</span>
                  <div className="admin-preview-unit">
                    <span className="admin-preview-number">{pad(countdown.mins)}</span>
                    <span className="admin-preview-label-text">MIN</span>
                  </div>
                  <span className="admin-preview-sep">:</span>
                  <div className="admin-preview-unit">
                    <span className="admin-preview-number">{pad(countdown.secs)}</span>
                    <span className="admin-preview-label-text">SEC</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3>Set Deadline</h3>
              <div className="admin-field">
                <label>Date & Time</label>
                <input
                  type="datetime-local"
                  value={settings.deadline}
                  onChange={(e) => handleChange('deadline', e.target.value)}
                />
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label>Drop Title</label>
                  <input
                    type="text"
                    value={settings.drop_title}
                    onChange={(e) => handleChange('drop_title', e.target.value)}
                    placeholder="DROP THIS SUNDAY 18 JUNE | 18:00"
                  />
                </div>
                <div className="admin-field">
                  <label>Early Access Text</label>
                  <input
                    type="text"
                    value={settings.early_access_text}
                    onChange={(e) => handleChange('early_access_text', e.target.value)}
                    placeholder="EARLY ACCESS | 17:40"
                  />
                </div>
              </div>

              <button className="admin-btn admin-btn-primary" onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="admin-page">
            <div className="admin-page-header">
              <h1>Page Content</h1>
              <p>Edit the text and links displayed on the landing page.</p>
            </div>

            <div className="admin-card">
              <h3>Bottom Section</h3>
              <div className="admin-field">
                <label>Section Title</label>
                <input
                  type="text"
                  value={settings.bottom_title}
                  onChange={(e) => handleChange('bottom_title', e.target.value)}
                  placeholder="Chance auf Early Access"
                />
              </div>
              <div className="admin-field">
                <label>Section Description</label>
                <textarea
                  value={settings.bottom_description}
                  onChange={(e) => handleChange('bottom_description', e.target.value)}
                  placeholder="Description text..."
                  rows={4}
                />
              </div>
            </div>

            <div className="admin-card">
              <h3>Links</h3>
              <div className="admin-field">
                <label>Collection URL</label>
                <div className="admin-input-with-icon">
                  <span className="admin-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                  </span>
                  <input
                    type="url"
                    value={settings.collection_url}
                    onChange={(e) => handleChange('collection_url', e.target.value)}
                    placeholder="https://example.com/collection"
                  />
                </div>
              </div>
            </div>

            <button className="admin-btn admin-btn-primary" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Subscribers Tab */}
        {activeTab === 'subscribers' && (
          <div className="admin-page">
            <div className="admin-page-header">
              <div className="admin-page-header-row">
                <div>
                  <h1>Subscribers</h1>
                  <p>{subscribers.length} registered email{subscribers.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="admin-btn admin-btn-export" onClick={exportSubscribers}>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  placeholder="Search emails..."
                  className="admin-search-input"
                />
              </div>

              {filteredSubscribers.length === 0 ? (
                <div className="admin-empty">
                  <p>{subscriberSearch ? 'No matching subscribers' : 'No subscribers yet'}</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Subscribed</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubscribers.map((sub) => (
                        <tr key={sub.id}>
                          <td className="admin-table-email">{sub.email}</td>
                          <td className="admin-table-date">
                            {new Date(sub.created_at).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="admin-table-actions">
                            <button
                              className="admin-btn-delete"
                              onClick={() => deleteSubscriber(sub.id)}
                              title="Remove subscriber"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="admin-page">
            <div className="admin-page-header">
              <h1>Integrations</h1>
              <p>Connect external services to sync subscriber data automatically.</p>
            </div>

            <div className="admin-card">
              <h3>Klaviyo</h3>
              <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
                New subscribers will be automatically added to your Klaviyo list for email marketing.
              </p>
              <div className="admin-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={settings.klaviyo_api_key}
                  onChange={(e) => handleChange('klaviyo_api_key', e.target.value)}
                  placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
                  autoComplete="off"
                />
              </div>
              <div className="admin-field">
                <label>List ID</label>
                <input
                  type="text"
                  value={settings.klaviyo_list_id}
                  onChange={(e) => handleChange('klaviyo_list_id', e.target.value)}
                  placeholder="AbCdEf"
                  autoComplete="off"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={saveKlaviyo}
                  disabled={savingKlaviyo}
                >
                  {savingKlaviyo ? 'Saving...' : 'Save Klaviyo Settings'}
                </button>
                <button
                  className="admin-btn admin-btn-export"
                  onClick={testKlaviyo}
                  disabled={klaviyoTesting || !settings.klaviyo_api_key || !settings.klaviyo_list_id}
                >
                  {klaviyoTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="admin-page">
            <div className="admin-page-header">
              <h1>Security</h1>
              <p>Update your admin account password.</p>
            </div>

            <div className="admin-card">
              <h3>Change Password</h3>
              <form onSubmit={changePassword}>
                <div className="admin-field">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="admin-field-row">
                  <div className="admin-field">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
