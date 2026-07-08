import axiosInstance from './axiosInstance';

// Thin wrapper around the backup endpoints — mirrors the other helper/*Api
// modules in this app (axiosInstance already carries auth + org headers).
export const getBackups = () => axiosInstance.get('/api/backups/');
export const triggerBackup = () => axiosInstance.post('/api/backups/run');
export const getBackupDetail = (slot) => axiosInstance.get(`/api/backups/${slot}`);
// Excel (.xlsx) file — must be fetched as a blob (auth header goes through
// axios, not a plain <a href>), then saved via an object URL.
export const downloadBackupExcel = (slot) => axiosInstance.get(`/api/backups/${slot}/download`, { responseType: 'blob' });
export const restoreBackup = (slot) => axiosInstance.post(`/api/backups/${slot}/restore`, { confirm: true });
