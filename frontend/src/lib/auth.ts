import api from './api';
import { Token, User } from '@/types';

export async function login(usernameOrEmail: string, password: string): Promise<Token> {
  const { data } = await api.post<Token>('/auth/login', {
    username_or_email: usernameOrEmail,
    password,
  });
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string,
  full_name?: string
): Promise<User> {
  const { data } = await api.post<User>('/auth/register', {
    username,
    email,
    password,
    full_name,
  });
  return data;
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
