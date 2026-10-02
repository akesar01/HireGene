import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen">
      <Header maxWidth="max-w-3xl" />
      <div className="max-w-md mx-auto px-6 py-16">
        <Suspense fallback={<p className="text-sm text-muted">One moment…</p>}>
          <UnsubscribeClient />
        </Suspense>
      </div>
    </div>
  );
}
