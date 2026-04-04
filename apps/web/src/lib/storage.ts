const AUTH_TOKEN_KEY = 'fi_auth_token_v1';

export const storage = {
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },
};
