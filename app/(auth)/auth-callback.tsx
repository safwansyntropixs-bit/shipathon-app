import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AuthCallback() {
  // This route is purely a dummy anchor for the OAuth deep link.
  // The global _layout.tsx automatically detects if the user is authenticated 
  // or not and redirects them instantly to either the dashboard or signin.
  return null;
}


