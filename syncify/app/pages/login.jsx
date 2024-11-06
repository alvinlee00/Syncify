// utils/users.js

import { account, ID } from './appwrite';

export const login = async (email, password) => {
  try {
    await account.createEmailSession(email, password);
    const user = await account.get();
    return user;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

export const register = async (email, password, name) => {
  try {
    await account.create(ID.unique(), email, password, name);
    return await login(email, password); // Automatically log in after registration
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await account.deleteSession('current');
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    console.error('Fetching current user failed:', error);
    throw error;
  }
};
