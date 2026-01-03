import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import { Input, Select } from '../components/Input';
import { api } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    email: '',
    mobile: '',
    default_currency: 'USD',
    profile_image: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.getCurrentUser();
      setProfile(response.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('mobile', profile.mobile || '');
      formData.append('default_currency', profile.default_currency);
      if (profileImageFile) {
        formData.append('profile_image', profileImageFile);
      }

      const response = await api.updateProfile(formData);
      updateUser(response.data);
      setSuccess('Profile updated successfully');
      setProfileImageFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setSaving(true);

    try {
      await api.changePassword(passwordForm.current_password, passwordForm.new_password);
      setSuccess('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading profile...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="profile-page">
        <h1>Profile</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <Card title="Profile Information">
          <form onSubmit={handleUpdateProfile}>
            <Input
              label="Email"
              type="email"
              value={profile.email}
              disabled
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={profile.mobile || ''}
              onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
              placeholder="Enter mobile number"
            />
            <Select
              label="Default Currency"
              options={CURRENCIES}
              value={profile.default_currency}
              onChange={(e) => setProfile({ ...profile, default_currency: e.target.value })}
            />
            <div className="form-group">
              <label className="form-label">Profile Image</label>
              {profile.profile_image && !profileImageFile && (
                <div className="profile-image-preview">
                  <img src={profile.profile_image} alt="Profile" />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Update Profile'}
            </Button>
          </form>
        </Card>

        <Card title="Change Password">
          <form onSubmit={handleChangePassword}>
            <Input
              type="password"
              label="Current Password"
              value={passwordForm.current_password}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, current_password: e.target.value })
              }
              required
            />
            <Input
              type="password"
              label="New Password"
              value={passwordForm.new_password}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, new_password: e.target.value })
              }
              required
            />
            <Input
              type="password"
              label="Confirm New Password"
              value={passwordForm.confirm_password}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
              }
              required
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}

