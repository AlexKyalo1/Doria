import { createContext, useState } from "react";
import { login as apiLogin, logout as apiLogout } from "../api/auth";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
    try {
      await apiLogin(username, password);
      setUser({ username });
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};