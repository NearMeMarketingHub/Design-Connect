import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  Loader2,
  Building2,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  User as UserIcon,
  Camera
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UppyFile, UploadResult } from "@uppy/core";

export default function MyProfile() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (user?.phone) {
      setPhoneValue(user.phone);
    }
  }, [user?.phone]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { phone?: string }) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your phone number has been updated.",
      });
      refetch();
      setIsEditingPhone(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update profile",
        variant: "destructive",
      });
    },
  });

  const updateProfilePictureMutation = useMutation({
    mutationFn: async (objectPath: string) => {
      const res = await fetch("/api/user/profile-picture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile picture");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile picture has been updated successfully.",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update profile picture",
        variant: "destructive",
      });
    },
  });

  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const res = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await res.json();
      setUploadedPath(objectPath);
      return {
        method: "PUT",
        url: uploadURL,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      };
    },
    []
  );

  const handleUploadComplete = useCallback(
    (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      if (result.successful && result.successful.length > 0 && uploadedPath) {
        updateProfilePictureMutation.mutate(uploadedPath);
        setUploadedPath(null);
      }
    },
    [uploadedPath, updateProfilePictureMutation]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const backUrl = user.role === "company_owner" ? "/company/dashboard" : user.role === "contractor" ? "/contractor/dashboard" : user.role === "admin" ? "/admin/dashboard" : "/client/dashboard";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href={backUrl}>
              <Button variant="ghost" size="sm" data-testid="btn-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>View and update your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {user.profilePicture ? (
                    <img 
                      src={user.profilePicture} 
                      alt={user.name || user.username}
                      className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                      data-testid="img-profile-picture"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                      <UserIcon className="w-16 h-16 text-primary" />
                    </div>
                  )}
                </div>
                
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonClassName="gap-2"
                  testId="btn-upload-profile-photo"
                >
                  <Camera className="w-4 h-4" />
                  {user.profilePicture ? "Change Photo" : "Upload Photo"}
                </ObjectUploader>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{user.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Username</p>
                    <p className="font-medium">{user.username}</p>
                  </div>
                </div>

                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{user.email}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  {isEditingPhone ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="tel"
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="h-8 max-w-[200px]"
                        data-testid="input-phone"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => updateProfileMutation.mutate({ phone: phoneValue })}
                        disabled={updateProfileMutation.isPending}
                        data-testid="btn-save-phone"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setIsEditingPhone(false);
                          setPhoneValue(user.phone || "");
                        }}
                        data-testid="btn-cancel-phone"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{user.phone || "-"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 ml-2"
                        onClick={() => setIsEditingPhone(true)}
                        data-testid="btn-edit-phone"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>

                {user.companyName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Company:</span>
                    <span className="font-medium">{user.companyName}</span>
                  </div>
                )}

                {user.companyType && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Company Type:</span>
                    <Badge variant="outline">{user.companyType}</Badge>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
