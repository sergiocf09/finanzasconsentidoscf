import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { VoiceButton } from "../voice/VoiceButton";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile Navigation */}
      <MobileNav open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <main className="lg:pl-72 min-h-screen overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-8 overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      {/* Floating Voice Button - Central Feature */}
      <VoiceButton />
    </div>
  );
}
