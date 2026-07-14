"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchMe = useAuthStore((state) => state.fetchMe);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      // Fetch user profile and redirect to dashboard
      fetchMe().then(() => {
        router.push("/dashboard");
      }).catch((err) => {
        console.error("Failed to fetch user profile after OAuth login:", err);
        router.push("/login?error=OAuth failed");
      });
    } else {
      console.error("Tokens not found in URL");
      router.push("/login?error=OAuth tokens missing");
    }
  }, [searchParams, router, fetchMe]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-4 animate-fade-in-up">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface font-medium tracking-wide">Completing login...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}

