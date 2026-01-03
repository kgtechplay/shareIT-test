import axios from 'axios';

const API_BASE_URL = '/api';

export const api = {
  // Auth
  login: (email: string, password: string) => axios.post(`${API_BASE_URL}/auth/login`, { email, password }),
  signup: (email: string) => axios.post(`${API_BASE_URL}/auth/signup`, { email }),
  forgotPassword: (email: string) => axios.post(`${API_BASE_URL}/auth/forgot-password`, { email }),

  // Users
  getCurrentUser: () => axios.get(`${API_BASE_URL}/users/me`),
  updateProfile: (data: FormData) => axios.put(`${API_BASE_URL}/users/me`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (currentPassword: string, newPassword: string) => axios.put(`${API_BASE_URL}/users/change-password`, { current_password: currentPassword, new_password: newPassword }),
  searchUsers: (email: string) => axios.get(`${API_BASE_URL}/users/search`, { params: { email } }),

  // Projects
  getProjects: () => axios.get(`${API_BASE_URL}/projects`),
  getProject: (id: string) => axios.get(`${API_BASE_URL}/projects/${id}`),
  createProject: (data: any) => axios.post(`${API_BASE_URL}/projects`, data),
  updateProject: (id: string, data: any) => axios.put(`${API_BASE_URL}/projects/${id}`, data),
  deleteProject: (id: string) => axios.delete(`${API_BASE_URL}/projects/${id}`),
  addProjectMember: (projectId: string, userId: string, role: string) => axios.post(`${API_BASE_URL}/projects/${projectId}/members`, { user_id: userId, role }),
  removeProjectMember: (projectId: string, memberId: string) => axios.delete(`${API_BASE_URL}/projects/${projectId}/members/${memberId}`),

  // Expenses
  getExpenses: (projectId: string) => axios.get(`${API_BASE_URL}/expenses/project/${projectId}`),
  createExpense: (data: FormData) => axios.post(`${API_BASE_URL}/expenses`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateExpense: (id: string, data: FormData) => axios.put(`${API_BASE_URL}/expenses/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteExpense: (id: string) => axios.delete(`${API_BASE_URL}/expenses/${id}`),

  // Payments
  getPaymentSummary: (projectId: string) => axios.get(`${API_BASE_URL}/payments/project/${projectId}/summary`),
  getPaymentTransactions: (projectId: string) => axios.get(`${API_BASE_URL}/payments/project/${projectId}/transactions`),
  makePayment: (data: FormData) => axios.post(`${API_BASE_URL}/payments`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updatePaymentStatus: (id: string, status: string) => axios.put(`${API_BASE_URL}/payments/${id}/status`, { status }),

  // Dashboard
  getDashboard: (filters?: { project_ids?: string; user_ids?: string; start_date?: string; end_date?: string }) => 
    axios.get(`${API_BASE_URL}/dashboard`, { params: filters }),
};

