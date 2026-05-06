import { type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card flex items-center justify-end px-6 h-12">
        <ThemeToggle />
      </div>
      <div>{children}</div>
    </div>
  );
}
