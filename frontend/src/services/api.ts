import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Um 401 na própria tentativa de login (usuário/senha errados, conta
    // bloqueada) é um erro de CREDENCIAIS, não de SESSÃO expirada — não deve
    // disparar o redirect/reload global. O reload apagava o formulário antes
    // do componente de Login conseguir exibir a mensagem de erro, dando a
    // impressão de que os campos eram "limpos" em vez de mostrar o erro.
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function userIdsParam(ids: number[]): string {
  return ids.length > 0 ? `?user_ids=${ids.join(',')}` : '';
}

export default api;