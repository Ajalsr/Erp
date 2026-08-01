import axiosInstance from './axiosInstance';

export const getProjects = (params) => axiosInstance.get('/api/projects/', { params });
export const getProject = (id) => axiosInstance.get(`/api/projects/${id}`);
export const createProject = (data) => axiosInstance.post('/api/projects/', data);
export const updateProject = (id, data) => axiosInstance.put(`/api/projects/${id}`, data);
export const deleteProject = (id) => axiosInstance.delete(`/api/projects/${id}`);
