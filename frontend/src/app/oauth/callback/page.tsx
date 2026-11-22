"use client";


import PageSkeleton from '@/components/ui/PageSkeleton';
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
    const needsOnboarding = searchParams.get("onboarding") === "true";

    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      // Fetch user profile then route accordingly
      fetchMe().then(() => {
        if (needsOnboarding) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }).catch((err) => {
        console.error("Failed to fetch user profile after OAuth login:", err);
        router.push("/login?error=OAuth failed");
      });
    } else {
      console.error("Tokens not found in URL");
      router.push("/login?error=OAuth tokens missing");
    }
  }, [searchParams, router, fetchMe]);

  /* PANDAHUB_OAUTH_SHIMMER */
  return <PageSkeleton variant="form" label="Completing sign-in" />;

}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" label="Loading authentication" />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
