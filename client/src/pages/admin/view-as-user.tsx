import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Eye } from "lucide-react";

export default function AdminViewAsUser() {
  return (
    <SuperAdminLayout>
      <div className="max-w-2xl mx-auto py-20 flex flex-col items-center text-center gap-4">
        <div className="p-4 bg-muted rounded-full">
          <Eye className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">View As User</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          The ability to impersonate any user and browse the platform from their perspective is
          planned for a future phase. Check back soon.
        </p>
      </div>
    </SuperAdminLayout>
  );
}
