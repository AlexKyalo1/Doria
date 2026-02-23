import axios from "axios";

axios.defaults.withCredentials = true; // send Django session cookies

export const signup = (username, password) => {
  return axios.post("https://matokeo.co.ke/accounts/api/signup/", { username, password });
};

export const login = (username, password) => {
  return axios.post("https://matokeo.co.ke/accounts/api/login/", { username, password });
};

export const logout = () => {
  return axios.post("https://matokeo.co.ke/accounts/api/logout/");
};