"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchMe = useAuthStore(state => state.fetchMe);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams?.get("access_token");
      const refreshToken = searchParams?.get("refresh_token");

      if (accessToken && refreshToken) {
        // Save tokens to localStorage (as handled by the standard login flow)
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);

        // Fetch user info to hydrate the auth store
        await fetchMe();
        
        // Redirect to dashboard
        router.push("/dashboard");
      } else {
        setError("Failed to authenticate with Google. Missing tokens.");
        // After a delay, send them back to login
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, router, fetchMe]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] dark:bg-[#0f172a]">
      <div className="flex flex-col items-center">
        {!error ? (
          <>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Authenticating...</h2>
            <p className="text-slate-500 mt-2">Please wait while we log you in.</p>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Error</h2>
            <p className="text-red-500 mt-2">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
