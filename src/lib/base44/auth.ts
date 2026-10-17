import { base44 } from "./client";

export interface AppUser {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string;
}

/** Returns the signed-in user, or null when signed out / token invalid. */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    if (!base44.auth.hasToken()) return null;
    if (!(await base44.auth.isAuthenticated())) return null;
    return (await base44.auth.me()) as AppUser;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  const res = await base44.auth.loginViaEmailPassword(email, password);
  base44.auth.setToken(res.access_token, true);
  return res.user as AppUser;
}

export async function signUp(email: string, password: string) {
  return base44.auth.register({ email, password });
}

export const verifyEmail = (email: string, otpCode: string) =>
  base44.auth.verifyOtp({ email, otpCode });
export const resendCode = (email: string) => base44.auth.resendOtp(email);
export const requestPasswordReset = (email: string) => base44.auth.resetPasswordRequest(email);
export const signInWithGoogle = (redirectTo = "/chat") =>
  base44.auth.loginWithProvider("google", `${window.location.origin}${redirectTo}`);

export function signOut(redirectTo = "/") {
  base44.auth.logout(`${window.location.origin}${redirectTo}`);
}

export function getToken(): string | null {
  try {
    return (
      window.localStorage.getItem("base44_access_token") ??
      window.localStorage.getItem("token") ??
      null
    );
  } catch {
    return null;
  }
}

/** Human friendly message from an SDK/axios error. */
export function authErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  return e?.response?.data?.message || e?.response?.data?.detail || e?.message || "Something went wrong.";
}
