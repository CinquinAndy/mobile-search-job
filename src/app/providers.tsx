"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PushManager } from "@/components/notifications/push-manager";
import { AuthProvider } from "@/hooks/use-auth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <AuthProvider>
        <AuthGuard>
          {children}
          <PushManager />
        </AuthGuard>
      </AuthProvider>
    </NuqsAdapter>
  );
}
