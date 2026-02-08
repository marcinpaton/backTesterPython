import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Credentials from backend .env
// In a production app, these should be in a .env file or Expo secrets
// For this personal prototype, hardcoding is acceptable for simplicity to avoid Metro config issues
const SUPABASE_URL = 'https://ttnrazvdvezrnfmnxenl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0bnJhenZkdmV6cm5mbW54ZW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjEzOTUsImV4cCI6MjA4NTEzNzM5NX0.E0qdfrT16DUgYu-IqXO5dSv3RcGvhVf2_a7V69scdEw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
