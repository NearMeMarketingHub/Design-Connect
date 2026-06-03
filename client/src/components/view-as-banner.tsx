import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Eye, X } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  company_owner: "Company Owner",
  client: "Client",
};

export function ViewAsBanner() {
  const { user, viewAsAdmin, exitViewAs } = useAuth();
  const [, setLocation] = useLocation();

  if (!viewAsAdmin) return null;

  const handleExit = async () => {
    await exitViewAs();
    setLocation("/admin/view-as-user");
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-400 text-amber-950 flex items-center justify-between gap-3 px-4 h-10 shadow-md"
      data-testid="view-as-banner"
    >
      <div className="flex items-center gap-2 text-sm font-medium min-w-0">
        <Eye className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Viewing as{" "}
          <strong>{user?.name ?? user?.username}</strong>
          {user?.email && (
            <span className="font-normal opacity-80"> · {user.email}</span>
          )}
          {user?.role && (
            <span className="font-normal opacity-80">
              {" · "}{ROLE_LABELS[user.role] ?? user.role}
            </span>
          )}
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 text-sm font-semibold bg-amber-950/10 hover:bg-amber-950/20 px-3 py-1 rounded-md transition-colors shrink-0"
        data-testid="button-exit-view-as"
      >
        <X className="w-3.5 h-3.5" />
        Exit View As
      </button>
    </div>
  );
}
