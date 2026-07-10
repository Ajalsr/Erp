import axiosInstance from './axiosInstance';

export const getLetterTypes = () => axiosInstance.get('/api/letters/types');
export const getLetters = (params) => axiosInstance.get('/api/letters/', { params });
export const getLetter = (id) => axiosInstance.get(`/api/letters/${id}`);
export const createLetter = (data) => axiosInstance.post('/api/letters/', data);
export const updateLetter = (id, data) => axiosInstance.put(`/api/letters/${id}`, data);
export const deleteLetter = (id) => axiosInstance.delete(`/api/letters/${id}`);
export const sendLetterEmail = (id, to, message) => axiosInstance.post(`/api/letters/${id}/send-email`, { to, message });
