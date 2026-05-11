import { SuperAdminLayout } from "@/components/super-admin-layout";
import { FileText } from "lucide-react";

export default function AdminAuditLog() {
  return (
    <SuperAdminLayout>
      <div className="max-w-2xl mx-auto py-20 flex flex-col items-center text-center gap-4">
        <div className="p-4 bg-muted rounded-full">
          <FileText className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          A full audit trail of admin actions, user logins, and key platform events is planned for
          a future phase. Check back soon.
        </p>
      </div>
    </SuperAdminLayout>
  );
}
