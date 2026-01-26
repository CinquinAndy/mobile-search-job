"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PushManager } from "@/components/notifications/push-manager";
import { AuthProvider } from "@/hooks/use-auth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        {children}
        <PushManager />
      </AuthGuard>
    </AuthProvider>
  );
}
