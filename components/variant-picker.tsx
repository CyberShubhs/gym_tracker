"use client";

import { useState } from "react";
import { Check, Plus, Settings2, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { normalizeVariantId, type VariantOption } from "@/lib/variants";

// Compact chip that opens a sheet/dialog with the variant options. Sized
// for the exercise-card header — does NOT take a swipe gesture because the
// underlying <button> matches the carousel's interactive selector.
export function VariantPicker({
  exerciseId,
  activeVariant,
  activeLabel,
  options,
  customLabels,
  onSelect,
  onAddCustom,
  onRemoveCustom,
}: {
  exerciseId: string;
  activeVariant: string;
  activeLabel: string;
  options: VariantOption[];
  customLabels: string[];
  onSelect: (variantId: string) => void;
  onAddCustom: (label: string) => void;
  onRemoveCustom: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const norm = normalizeVariantId(activeVariant);
  const isDefault = norm === "default";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Pick machine variant for this exercise — current: ${activeLabel}`}
        title="Pick machine / cable stack variant"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
          isDefault
            ? "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
            : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
        )}
      >
        <Settings2 className="h-3 w-3" />
        {isDefault ? "Default machine" : activeLabel}
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Machine variant</DialogTitle>
              <DialogDescription>
                Different machines feel different. Pick the one you used so
                PRs and last-session comparisons stay accurate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3" data-no-swipe>
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                  const isActive = o.id === norm;
                  const isCustom = customLabels.some(
                    (c) => c.toLowerCase() === o.label.toLowerCase()
                  );
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                        isActive
                          ? "border-foreground bg-foreground/10"
                          : "border-border/60"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(o.id);
                          setOpen(false);
                        }}
                        className="font-medium"
                      >
                        {isActive && (
                          <Check className="mr-1 inline h-3 w-3 align-text-bottom" />
                        )}
                        {o.label}
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => onRemoveCustom(o.label)}
                          aria-label={`Remove custom variant ${o.label}`}
                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`var-add-${exerciseId}`} className="text-xs">
                  Add custom variant
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`var-add-${exerciseId}`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Smith machine"
                    maxLength={30}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = newName.trim();
                        if (!v) return;
                        onAddCustom(v);
                        setNewName("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Add variant"
                    onClick={() => {
                      const v = newName.trim();
                      if (!v) return;
                      onAddCustom(v);
                      setNewName("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Custom variants are saved for this exercise only.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
