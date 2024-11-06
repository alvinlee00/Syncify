import { Client, Account } from 'appwrite';

export const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('672adc1b003b626f9cf8'); 

export const account = new Account(client);
export { ID } from 'appwrite';
