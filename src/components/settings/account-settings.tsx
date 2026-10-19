"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/actions/profile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AccountSettings({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === "DELETE MY ACCOUNT";

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccount();
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Your account and data have been deleted.");
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Deleting your account removes every entry, weight log, goal, and
          AI analysis. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setConfirmText("");
            setOpen(true);
          }}
        >
          Delete account
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes your auth account and all associated
                data. There is no undo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-semibold">DELETE MY ACCOUNT</span> to
                confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={!canDelete || deleting}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
