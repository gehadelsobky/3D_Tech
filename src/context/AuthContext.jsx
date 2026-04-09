import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      apiGet('/auth/me')
        .then((data) => setUser(data))
        .catch(() => localStorage.removeItem('auth_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const { token, user: userData } = await apiPost('/auth/login', { username, password });
    localStorage.setItem('auth_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const hasPermission = useCallback((perm) => {
    return user?.permissions?.includes(perm) || false;
  }, [user]);

  const changePassword = async (currentPassword, newPassword) => {
    await apiPut('/auth/password', { currentPassword, newPassword });
  };

  const updateProfile = async (data) => {
    const updated = await apiPut('/auth/profile', data);
    setUser(updated);
  };

  const refreshUser = async () => {
    const data = await apiGet('/auth/me');
    setUser(data);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      hasPermission,
      isSuperAdmin: !!user?.is_system,
      loading,
      changePassword,
      updateProfile,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
