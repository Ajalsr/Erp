import axiosInstance from './axiosInstance';

// Thin wrapper around the transaction-export endpoints. getExportTypes() is the
// single source of truth for the checkbox list — nothing is hardcoded here.
export const getExportTypes = () => axiosInstance.get('/api/export/types');

export const previewExportCount = (types, startDate, endDate) =>
  axiosInstance.get('/api/export/preview-count', {
    params: { types: types.join(','), startDate, endDate },
  });

// Must be fetched as a blob (auth header goes through axios, not a plain <a href>).
export const exportTransactions = (types, startDate, endDate) =>
  axiosInstance.post('/api/export/transactions', { types, startDate, endDate }, { responseType: 'blob' });
