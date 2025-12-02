import { Api } from '../services';

export const login = (username: string, password: string) =>
    Api.post('/auth/login', { username, password }).then(res => res.data);

export const getCurrentUser = () =>
    Api.get('/auth/me').then(res => res.data);

export const logout = () =>
    Api.post('/auth/logout').then(res => res.data);