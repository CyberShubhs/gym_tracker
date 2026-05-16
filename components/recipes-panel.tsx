"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChefHat, Pencil, Plus, Trash2 } from "lucide-react";
import type { Recipe, RecipeIngredient } from "@/lib/types";
import {
  FOOD_PRESETS,
  UNIT_LABEL,
  type FoodUnit,
} from "@/lib/foods";
import { useStore } from "@/lib/store";
import { EmojiPicker, suggestEmoji } from "@/components/emoji-picker";
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

export type FoodLikeRef = {
  id: string;
  name: string;
  emoji: string;
  unit: FoodUnit;
  defaultAmount: number;
  caloriesPer: number;
  proteinPer: number;
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
};

// Resolve the *current* per-unit macros for an ingredient. If the ingredient
// references a food id and the resolver finds it, use the live macros; this is
// how editing a food makes every recipe recompute. Manual ingredients (no
// foodId) and ingredients whose food was deleted fall back to the snapshot
// stored on the ingredient row.
export function liveIngredientMacros(
  ing: RecipeIngredient,
  resolver?: (id: string) => FoodLikeRef | undefined
): {
  caloriesPer: number;
  proteinPer: number;
  fiberPer: number;
  carbsPer: number;
  fatsPer: number;
  isStale: boolean;
  missing: boolean;
} {
  if (ing.foodId && resolver) {
    const food = resolver(ing.foodId);
    if (food) {
      return {
        caloriesPer: food.caloriesPer,
        proteinPer: food.proteinPer,
        fiberPer: food.fiberPer ?? 0,
        carbsPer: food.carbsPer ?? 0,
        fatsPer: food.fatsPer ?? 0,
        isStale: false,
        missing: false,
      };
    }
    return {
      caloriesPer: ing.caloriesPer,
      proteinPer: ing.proteinPer,
      fiberPer: ing.fiberPer ?? 0,
      carbsPer: ing.carbsPer ?? 0,
      fatsPer: ing.fatsPer ?? 0,
      isStale: true,
      missing: true,
    };
  }
  return {
    caloriesPer: ing.caloriesPer,
    proteinPer: ing.proteinPer,
    fiberPer: ing.fiberPer ?? 0,
    carbsPer: ing.carbsPer ?? 0,
    fatsPer: ing.fatsPer ?? 0,
    isStale: false,
    missing: false,
  };
}

export function computeRecipeTotals(
  recipe: Recipe,
  resolver?: (id: string) => FoodLikeRef | undefined
): {
  calories: number;
  protein: number;
  fiber: number;
  carbs: number;
  fats: number;
  missingIds: string[];
} {
  let calories = 0;
  let protein = 0;
  let fiber = 0;
  let carbs = 0;
  let fats = 0;
  const missingIds: string[] = [];
  for (const ing of recipe.ingredients) {
    const live = liveIngredientMacros(ing, resolver);
    calories += live.caloriesPer * ing.amount;
    protein += live.proteinPer * ing.amount;
    fiber += live.fiberPer * ing.amount;
    carbs += live.carbsPer * ing.amount;
    fats += live.fatsPer * ing.amount;
    if (live.missing && ing.foodId) missingIds.push(ing.foodId);
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fats: Math.round(fats * 10) / 10,
    missingIds,
  };
}

function makeId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function RecipesPanel({
  recipes,
  foodResolver,
  onSave,
  onRemove,
  onAddRecipeToLog,
  onAddIngredientsToLog,
}: {
  recipes: Recipe[];
  foodResolver: (id: string) => FoodLikeRef | undefined;
  onSave: (r: Recipe) => void;
  onRemove: (id: string) => void;
  onAddRecipeToLog: (r: Recipe) => void;
  onAddIngredientsToLog: (r: Recipe) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowManage(true)}
          className="flex-1"
        >
          <ChefHat className="h-3.5 w-3.5 text-violet-400" />
          My recipes ({recipes.length})
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="flex-1"
        >
          <Plus className="h-3.5 w-3.5" /> New recipe
        </Button>
      </div>

      {showCreate && (
        <RecipeEditor
          foodResolver={foodResolver}
          onClose={() => setShowCreate(false)}
          onSave={(r) => {
            onSave(r);
            setShowCreate(false);
          }}
        />
      )}

      {showManage && (
        <Dialog open onOpenChange={(o) => !o && setShowManage(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>My recipes</DialogTitle>
              <DialogDescription>
                Recipes group ingredients into a single meal you can log in one
                tap.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {recipes.length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No recipes yet. Tap &ldquo;New recipe&rdquo; to make one.
                </p>
              )}
              {recipes.map((r) => {
                const totals = computeRecipeTotals(r, foodResolver);
                const hasMissing = totals.missingIds.length > 0;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-1 overflow-hidden rounded-lg border border-violet-500/40 bg-violet-500/5 p-2"
                  >
                    <span className="shrink-0 text-lg">{r.emoji ?? "🍽"}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {r.name}
                        {hasMissing && (
                          <span className="ml-1 inline-flex items-center gap-0.5 align-middle font-mono text-[9px] uppercase tracking-wider text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {totals.missingIds.length} missing
                          </span>
                        )}
                      </span>
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {totals.calories} kcal · {totals.protein}g P ·{" "}
                        {r.ingredients.length}{" "}
                        {r.ingredients.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setShowManage(false);
                        onAddRecipeToLog(r);
                      }}
                      aria-label="Add to today"
                      title="Add to today (1 entry)"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(r)}
                      aria-label="Edit"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(r.id)}
                      aria-label="Remove"
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManage(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editing && (
        <RecipeEditor
          recipe={editing}
          foodResolver={foodResolver}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            onSave(r);
            setEditing(null);
          }}
          onAddSplit={() => {
            onAddIngredientsToLog(editing);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function RecipeEditor({
  recipe,
  foodResolver,
  onClose,
  onSave,
  onAddSplit,
}: {
  recipe?: Recipe;
  foodResolver: (id: string) => FoodLikeRef | undefined;
  onClose: () => void;
  onSave: (r: Recipe) => void;
  onAddSplit?: () => void;
}) {
  const { state } = useStore();
  const [name, setName] = useState(recipe?.name ?? "");
  const [emoji, setEmoji] = useState(recipe?.emoji ?? "🥣");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients ?? []
  );
  const [showAddIng, setShowAddIng] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      computeRecipeTotals(
        {
          id: "tmp",
          name,
          ingredients,
        },
        foodResolver
      ),
    [ingredients, name, foodResolver]
  );
  const missingNames = useMemo(() => {
    return ingredients
      .filter((i) => i.foodId && !foodResolver(i.foodId))
      .map((i) => i.name);
  }, [ingredients, foodResolver]);

  const addIngredient = (ing: RecipeIngredient) => {
    setIngredients((prev) => [...prev, ing]);
    setShowAddIng(false);
  };

  const updateIngredientAmount = (id: string, amount: number) => {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, amount } : i))
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const submit = () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return setError("Name required");
    if (ingredients.length === 0) return setError("Add at least one ingredient");
    onSave({
      id: recipe?.id ?? makeId("recipe"),
      name: trimmed,
      emoji: emoji || "🍽",
      ingredients,
    });
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-violet-400" />
              {recipe ? "Edit recipe" : "New recipe"}
            </DialogTitle>
            <DialogDescription>
              Group multiple foods into a single meal template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-name">Name</Label>
              <Input
                id="rc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Oats"
                autoFocus
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredients</Label>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setShowAddIng(true)}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {ingredients.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  No ingredients yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {ingredients.map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ing={ing}
                      live={liveIngredientMacros(ing, foodResolver)}
                      onAmountChange={(a) => updateIngredientAmount(ing.id, a)}
                      onRemove={() => removeIngredient(ing.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {missingNames.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1 text-xs text-amber-200/90">
                  <p className="font-medium">Missing ingredient food</p>
                  <p className="font-mono text-[10px] text-amber-200/70">
                    {missingNames.join(", ")} — using last snapshot. Re-link by
                    removing and adding again.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-border/60 bg-card/40 p-2 text-center">
              <Stat label="kcal" value={totals.calories} />
              <Stat label="P" value={totals.protein} />
              <Stat label="C" value={totals.carbs} />
              <Stat label="F" value={totals.fats} />
              <Stat label="Fib" value={totals.fiber} />
            </div>

            {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            {recipe && onAddSplit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddSplit}
                className="text-muted-foreground"
              >
                Add split as items
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAddIng && (
        <IngredientPicker
          customFoods={state.settings.customFoods ?? []}
          foodResolver={foodResolver}
          onClose={() => setShowAddIng(false)}
          onPick={addIngredient}
        />
      )}
    </>
  );
}

function IngredientRow({
  ing,
  live,
  onAmountChange,
  onRemove,
}: {
  ing: RecipeIngredient;
  live: ReturnType<typeof liveIngredientMacros>;
  onAmountChange: (a: number) => void;
  onRemove: () => void;
}) {
  const [amt, setAmt] = useState(String(ing.amount));
  const kcal = Math.round(live.caloriesPer * ing.amount);
  const pro = Math.round(live.proteinPer * ing.amount * 10) / 10;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card/30 px-2 py-1.5",
        live.missing
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border/60"
      )}
    >
      <span className="text-base">{ing.emoji ?? "🍽"}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{ing.name}</span>
        <span
          className={cn(
            "font-mono text-[10px]",
            live.missing ? "text-amber-300/80" : "text-muted-foreground"
          )}
        >
          {kcal} kcal · {pro}g P
          {live.missing && " · linked food deleted"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          value={amt}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
            setAmt(cleaned);
            const n = parseFloat(cleaned);
            if (Number.isFinite(n) && n >= 0) onAmountChange(n);
          }}
          className="h-7 w-14 px-1.5 text-right font-mono text-xs"
        />
        <span className="w-6 font-mono text-[10px] text-muted-foreground">
          {UNIT_LABEL[ing.unit]}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Remove ingredient"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function IngredientPicker({
  customFoods,
  foodResolver,
  onClose,
  onPick,
}: {
  customFoods: { id: string }[];
  foodResolver: (id: string) => FoodLikeRef | undefined;
  onClose: () => void;
  onPick: (ing: RecipeIngredient) => void;
}) {
  const [search, setSearch] = useState("");
  const [showManual, setShowManual] = useState(false);

  const allFoods = useMemo<FoodLikeRef[]>(() => {
    const list: FoodLikeRef[] = [];
    for (const p of FOOD_PRESETS) {
      const resolved = foodResolver(p.id);
      list.push(resolved ?? (p as unknown as FoodLikeRef));
    }
    for (const c of customFoods) {
      const r = foodResolver(c.id);
      if (r) list.push(r);
    }
    return list;
  }, [customFoods, foodResolver]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allFoods.slice(0, 20);
    return allFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allFoods, search]);

  const pickFood = (f: FoodLikeRef) => {
    onPick({
      id: makeId("ing"),
      foodId: f.id,
      name: f.name,
      emoji: f.emoji,
      unit: f.unit,
      amount: f.defaultAmount,
      caloriesPer: f.caloriesPer,
      proteinPer: f.proteinPer,
      fiberPer: f.fiberPer,
      carbsPer: f.carbsPer,
      fatsPer: f.fatsPer,
    });
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ingredient</DialogTitle>
            <DialogDescription>
              Pick a saved food, or add a manual entry with macros.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search foods…"
              autoFocus
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => pickFood(f)}
                  className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-card/30 px-2 py-1.5 text-left hover:border-foreground"
                >
                  <span className="text-base">{f.emoji ?? "🍽"}</span>
                  <span className="flex-1 truncate text-sm">{f.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {Math.round(f.caloriesPer * f.defaultAmount)} kcal /{" "}
                    {f.defaultAmount}
                    {UNIT_LABEL[f.unit]}
                  </span>
                </button>
              ))}
              {results.length === 0 && (
                <p className="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                  No matches.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className={cn(
                "w-full rounded-md border border-dashed border-border/60 px-2 py-1.5 text-xs text-muted-foreground",
                "hover:border-foreground hover:text-foreground"
              )}
            >
              + Manual ingredient (custom macros)
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showManual && (
        <ManualIngredientDialog
          onClose={() => setShowManual(false)}
          onPick={(ing) => {
            setShowManual(false);
            onPick(ing);
          }}
        />
      )}
    </>
  );
}

function ManualIngredientDialog({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (ing: RecipeIngredient) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽");
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [amount, setAmount] = useState("100");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Name required");
    const a = unit === "piece" ? 1 : parseFloat(amount);
    if (!Number.isFinite(a) || a <= 0) return setError("Amount > 0");
    const cal = parseFloat(calories);
    const pro = parseFloat(protein);
    const fib = parseFloat(fiber) || 0;
    const car = parseFloat(carbs) || 0;
    const fat = parseFloat(fats) || 0;
    if (!Number.isFinite(cal) || cal < 0) return setError("Calories invalid");
    if (!Number.isFinite(pro) || pro < 0) return setError("Protein invalid");
    onPick({
      id: makeId("ing"),
      name: trimmed,
      emoji: emoji || suggestEmoji(trimmed),
      unit,
      amount: a,
      caloriesPer: cal / a,
      proteinPer: pro / a,
      fiberPer: fib / a,
      carbsPer: car / a,
      fatsPer: fat / a,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual ingredient</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mi-name">Name</Label>
            <Input
              id="mi-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <div className="flex gap-2">
              {(["g", "ml", "piece"] as FoodUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium",
                    unit === u
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 text-muted-foreground"
                  )}
                >
                  {u === "piece" ? "Piece" : u}
                </button>
              ))}
            </div>
          </div>
          {unit !== "piece" && (
            <div className="space-y-1.5">
              <Label htmlFor="mi-amt">Amount ({UNIT_LABEL[unit]})</Label>
              <Input
                id="mi-amt"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                className="font-mono"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field id="mi-cal" label="Calories" value={calories} setValue={setCalories} />
            <Field id="mi-pro" label="Protein (g)" value={protein} setValue={setProtein} />
            <Field id="mi-car" label="Carbs (g)" value={carbs} setValue={setCarbs} />
            <Field id="mi-fat" label="Fats (g)" value={fats} setValue={setFats} />
            <Field id="mi-fib" label="Fibre (g)" value={fiber} setValue={setFiber} />
          </div>
          {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  setValue,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
        className="font-mono"
      />
    </div>
  );
}
