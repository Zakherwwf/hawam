/**
 * Deep Link Authentication Handler
 * Hawem (حايم) Citizen-Science Platform
 *
 * Handles incoming deep links (exp:// and hawem://) carrying OAuth tokens
 * or email confirmation tokens, and activates the Supabase session in-app.
 */

import { supabase } from './supabase';

export async function handleAuthUrl(url: string): Promise<boolean> {
  try {
    if (!url) return false;
    // Never log the query or fragment: sign-in links carry access tokens
    console.log('[deepLinkAuth] Incoming link:', url.split(/[?#]/)[0]);

    // Extract query parameters and hash fragments
    const queryPart = (url.split('#')[0] || '').split('?')[1] || '';
    const hashPart = url.split('#')[1] || '';
    const combined = [queryPart, hashPart].filter(Boolean).join('&');

    if (!combined) return false;

    const params: Record<string, string> = {};
    for (const pair of combined.split('&')) {
      const [k, v] = pair.split('=');
      if (k && v) {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }

    if (params.error_description || params.error) {
      console.warn('[deepLinkAuth] Error in callback:', params.error_description || params.error);
      return false;
    }

    if (params.access_token && params.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        console.warn('[deepLinkAuth] Failed to set session:', error.message);
        return false;
      }

      return !!data.session;
    } else if (params.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);

      if (error) {
        console.warn('[deepLinkAuth] Failed to exchange code:', error.message);
        return false;
      }

      return !!data.session;
    }

    return false;
  } catch (err: any) {
    console.warn('[deepLinkAuth] Exception handling auth URL:', err?.message || err);
    return false;
  }
}
