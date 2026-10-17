"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getCurrentUser, type AppUser } from "@/lib/base44/auth";
import { isConfigured } from "@/lib/base44/client";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  setUser: (u: AppUser | null) => void;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
});

export const useAuth = () => React.useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => !cancelled && setUser(u))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = React.useMemo(() => ({ user, loading, setUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}

/** Wraps pages that require a signed-in user. Redirects to /login otherwise. */
export function RequireAuth({ children }: { children: (user: AppUser) => React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/chat")}`);
    }
  }, [loading, user, router, pathname]);

  if (!isConfigured) return <ConfigMissing />;
  if (loading || !user) return <FullScreenSpinner />;
  return <>{children(user)}</>;
}

/** Wraps login/register. Sends already-signed-in users to the app. */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [loading, user, router]);

  if (loading || user) return <FullScreenSpinner />;
  return <>{children}</>;
}

export function ConfigMissing() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">Backend not configured</h1>
        <p className="text-sm text-muted-foreground">
          Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_BASE44_APP_ID</code> and{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_BASE44_APP_URL</code> in your environment, then rebuild.
        </p>
      </div>
    </div>
  );
}
