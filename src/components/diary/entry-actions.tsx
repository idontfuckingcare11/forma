"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteFoodEntry,
  duplicateFoodEntry,
  updateFoodEntry,
} from "@/lib/actions/food";
import type { MealType } from "@/lib/db-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export function EntryActions({
  entryId,
  name,
  portionGrams,
  meal,
  viewDate,
}: {
  entryId: string;
  name: string;
  portionGrams: number;
  meal: MealType;
  viewDate: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editPortion, setEditPortion] = useState(String(portionGrams));
  const [busy, setBusy] = useState(false);

  const portionNum = Number(editPortion);
  const canSave =
    editName.trim().length > 0 &&
    Number.isFinite(portionNum) &&
    portionNum > 0 &&
    portionNum <= 5000 &&
    (editName.trim() !== name || portionNum !== portionGrams);

  async function saveEdit() {
    setBusy(true);
    const result = await updateFoodEntry({
      id: entryId,
      name: editName.trim(),
      portionGrams: portionNum,
      meal,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Entry updated.");
    setEditOpen(false);
    router.refresh();
  }

  async function duplicate() {
    setBusy(true);
    const result = await duplicateFoodEntry(entryId, viewDate);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`“${name}” duplicated to this day.`);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await deleteFoodEntry(entryId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`“${name}” removed.`);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Actions for ${name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setEditName(name);
              setEditPortion(String(portionGrams));
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={duplicate} disabled={busy}>
            <Copy className="size-4" />
            Duplicate to this day
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>
              Changing the portion recalculates calories and macros.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-portion">Portion</Label>
              <div className="relative">
                <Input
                  id="edit-portion"
                  inputMode="decimal"
                  value={editPortion}
                  onChange={(e) => setEditPortion(e.target.value)}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  grams
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit} disabled={!canSave || busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
            <DialogDescription>
              “{name}” will be removed from your diary and daily totals.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
