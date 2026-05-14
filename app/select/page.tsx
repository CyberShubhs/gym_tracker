"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft, Loader2, Lock, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createUser,
  listUsers,
  loginUser,
  type UserCard,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

const PALETTE = [
  "from-orange-500 to-amber-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-violet-500 to-fuchsia-500",
  "from-rose-500 to-pink-500",
  "from-yellow-500 to-orange-500",
  "from-indigo-500 to-purple-500",
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

type View =
  | { kind: "list" }
  | { kind: "passcode"; user: UserCard }
  | { kind: "new" };

export default function SelectPage() {
  const [users, setUsers] = useState<UserCard[] | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  if (users === null) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6">
        <Skeleton className="h-32 w-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-12">
      {view.kind === "list" && (
        <ListView
          users={users}
          onPick={(u) => setView({ kind: "passcode", user: u })}
          onAdd={() => setView({ kind: "new" })}
        />
      )}
      {view.kind === "passcode" && (
        <PasscodeView
          user={view.user}
          onBack={() => setView({ kind: "list" })}
        />
      )}
      {view.kind === "new" && (
        <NewUserView
          onBack={() => setView({ kind: "list" })}
          onCreated={(u) => {
            setUsers((prev) => (prev ? [...prev, u] : [u]));
          }}
        />
      )}
    </div>
  );
}

function ListView({
  users,
  onPick,
  onAdd,
}: {
  users: UserCard[];
  onPick: (u: UserCard) => void;
  onAdd: () => void;
}) {
  return (
    <div className="w-full space-y-10 text-center">
      <div className="space-y-2">
        <span className="inline-flex rounded-full border border-border/60 bg-card/40 p-3">
          <Dumbbell className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Who&apos;s working out?
        </h1>
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
        {users.map((u) => (
          <ProfileCard key={u.id} user={u} onClick={() => onPick(u)} />
        ))}
        <button
          onClick={onAdd}
          className="group flex flex-col items-center gap-2 outline-none"
        >
          <span className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/30 text-muted-foreground transition-colors group-hover:border-foreground group-hover:text-foreground group-focus-visible:border-foreground">
            <Plus className="h-7 w-7" />
          </span>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
            Add user
          </span>
        </button>
      </div>
    </div>
  );
}

function ProfileCard({
  user,
  onClick,
}: {
  user: UserCard;
  onClick: () => void;
}) {
  const initial = user.name.charAt(0).toUpperCase();
  const color = colorFor(user.name);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 outline-none"
    >
      <span
        className={cn(
          "flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-br font-semibold text-white shadow-lg transition-all group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-foreground",
          color
        )}
      >
        <span className="text-3xl">{initial}</span>
      </span>
      <span className="text-sm font-medium">{user.name}</span>
    </button>
  );
}

function PasscodeView({
  user,
  onBack,
}: {
  user: UserCard;
  onBack: () => void;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submittedRef = useRef("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (
      pin.length !== user.passcodeLength ||
      submittedRef.current === pin ||
      pending
    )
      return;
    submittedRef.current = pin;
    startTransition(async () => {
      const r = await loginUser(user.id, pin);
      if (r.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError("Wrong code");
        setPin("");
        submittedRef.current = "";
      }
    });
  }, [pin, pending, user, router]);

  const initial = user.name.charAt(0).toUpperCase();
  const color = colorFor(user.name);

  return (
    <div className="w-full max-w-xs space-y-6 text-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="self-start text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="flex flex-col items-center gap-3">
        <span
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl font-semibold text-white shadow-lg",
            color
          )}
        >
          {initial}
        </span>
        <h2 className="text-xl font-semibold">{user.name}</h2>
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3 w-3" />
          {user.passcodeLength}-digit passcode
        </p>
      </div>
      <div className="space-y-3">
        <Input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={user.passcodeLength}
          autoComplete="off"
          disabled={pending}
          value={pin}
          onChange={(e) => {
            const digits = e.target.value
              .replace(/\D/g, "")
              .slice(0, user.passcodeLength);
            setPin(digits);
            setError(null);
          }}
          placeholder={"•".repeat(user.passcodeLength)}
          className="text-center font-mono text-2xl tracking-[0.5em]"
        />
        <PinDots
          length={user.passcodeLength}
          filled={pin.length}
          pending={pending}
          error={!!error}
        />
        {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
        {pending && (
          <p className="flex items-center justify-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Unlocking…
          </p>
        )}
      </div>
    </div>
  );
}

function NewUserView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (u: UserCard) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinLen, setPinLen] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError("Name required");
      return;
    }
    if (pin.length < 4 || pin.length > 8) {
      setError("Passcode must be 4–8 digits");
      return;
    }
    setPinLen(pin.length);
    startTransition(async () => {
      const r = await createUser(name, pin);
      if (r.ok) {
        onCreated({
          id: r.userId!,
          name: name.trim(),
          passcodeLength: pin.length,
        });
        router.replace("/");
        router.refresh();
      } else {
        setError(r.error ?? "Failed");
      }
    });
  };

  return (
    <div className="w-full max-w-xs space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">New profile</h2>
        <p className="text-sm text-muted-foreground">
          Each profile keeps its own workouts and stats.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Name</Label>
          <Input
            id="new-name"
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pin">Passcode (4–8 digits)</Label>
          <Input
            id="new-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
              setPinLen(Math.max(pin.length, 4));
            }}
            placeholder="••••••"
            className="text-center font-mono text-xl tracking-[0.4em]"
          />
          <PinDots
            length={Math.max(pin.length, 4)}
            filled={pin.length}
            pending={pending}
            error={!!error}
          />
        </div>
        {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create profile"
          )}
        </Button>
      </form>
    </div>
  );
}

function PinDots({
  length,
  filled,
  pending,
  error,
}: {
  length: number;
  filled: number;
  pending: boolean;
  error: boolean;
}) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            error
              ? "bg-rose-500/70"
              : i < filled
              ? pending
                ? "bg-muted-foreground"
                : "bg-foreground"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
