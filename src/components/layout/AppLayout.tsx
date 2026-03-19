import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { VoiceButton } from "../voice/VoiceButton";
import { ReceiptScanner } from "../voice/ReceiptScanner";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useSaveLastRoute } from "@/hooks/useLastRoute";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useSwipeNavigation();
  useSaveLastRoute();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile Navigation */}
      <MobileNav open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <main className="lg:pl-72 min-h-screen overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-2 pb-24 sm:px-6 lg:px-8 lg:pt-4 lg:pb-8 overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      {/* Floating Buttons */}
      <ReceiptScanner />
      <VoiceButton />
    </div>
  );
}
