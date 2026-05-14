"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HeightPill() {
  const { state, updateSettings } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const onOpen = (next: boolean) => {
    if (next) setDraft(String(state.settings.heightCm));
    setOpen(next);
  };

  const save = () => {
    const cm = parseFloat(draft);
    if (Number.isFinite(cm) && cm > 0) {
      updateSettings({ heightCm: cm });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger
        render={
          <button className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-left transition-colors hover:bg-card/80">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Height
              </span>
              <span className="font-mono text-base font-semibold">
                {state.settings.heightCm} cm
              </span>
            </span>
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update height</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="height-input">Height (cm)</Label>
          <Input
            id="height-input"
            inputMode="decimal"
            type="number"
            step="0.1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="font-mono text-base"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
