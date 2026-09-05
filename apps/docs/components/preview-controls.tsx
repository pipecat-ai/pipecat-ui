"use client";

import { Settings2Icon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Connected previews mount only when selected. */
export function PreviewShell({
  children,
  tall = false,
  controls,
  connected,
}: {
  children: React.ReactNode;
  tall?: boolean;
  controls?: React.ReactNode;
  connected?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "connected">("view");
  const controlsId = useId();

  return (
    <TooltipProvider>
      <div className="not-prose bg-background @container relative rounded-xl border">
        {connected && (
          <div
            role="tablist"
            aria-label="Preview mode"
            className="bg-muted/60 absolute top-2 left-2 z-10 flex gap-0.5 rounded-lg border p-0.5"
          >
            {(["view", "connected"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "text-muted-foreground rounded-md px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase transition-colors",
                  mode === m && "bg-background text-foreground shadow-sm",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        {controls && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Configure preview"
            aria-expanded={open}
            aria-controls={controlsId}
            className={cn(
              "text-muted-foreground absolute top-2 right-2 z-10",
              open && "bg-muted text-foreground",
            )}
            onClick={() => setOpen((v) => !v)}
          >
            <Settings2Icon />
          </Button>
        )}
        <div
          className={cn(
            "flex items-center justify-center p-8",
            (connected || controls) && "pt-14",
            tall ? "min-h-72" : "min-h-40",
          )}
        >
          {mode === "connected" && connected ? connected : children}
        </div>
        {controls && open && (
          <div id={controlsId} className="flex flex-col gap-5 border-t p-4">
            {controls}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export function ControlSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 w-full border-b pb-2 text-xs font-medium">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 @lg:grid-cols-2">
        {children}
      </div>
    </fieldset>
  );
}

function ControlRow({
  label,
  htmlFor,
  children,
  inline = false,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className="@container/control min-w-0">
      <div
        className={cn(
          "flex min-h-8 gap-x-4 gap-y-2",
          inline
            ? "items-center justify-between"
            : "flex-col items-start @xs/control:flex-row @xs/control:items-center @xs/control:justify-between",
        )}
      >
        <Label
          htmlFor={htmlFor}
          className="text-muted-foreground min-w-0 font-mono text-xs leading-5 wrap-break-word"
        >
          {label}
        </Label>
        {children}
      </div>
    </div>
  );
}

export function BooleanControl({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <ControlRow label={label} htmlFor={id} inline>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </ControlRow>
  );
}

export function TextControl({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <ControlRow label={label} htmlFor={id}>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-44 max-w-full min-w-0 shrink-0 text-sm"
      />
    </ControlRow>
  );
}

export function NumberControl({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <ControlRow label={label} htmlFor={id}>
      <div className="flex w-44 max-w-full min-w-0 shrink-0 items-center gap-2">
        <Slider
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => {
            const n = Array.isArray(next) ? next[0] : next;
            if (typeof n === "number") onChange(n);
          }}
          className="min-w-0 flex-1"
        />
        <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
          {Number.isInteger(value) ? value : value.toFixed(2)}
        </span>
      </div>
    </ControlRow>
  );
}

export function ColorControl({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <ControlRow label={label} htmlFor={id}>
      <div className="flex w-44 max-w-full min-w-0 shrink-0 items-center gap-2">
        {/* Text also accepts CSS variables, currentColor, or an empty default. */}
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="border-input h-8 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 min-w-0 flex-1 text-sm"
        />
      </div>
    </ControlRow>
  );
}

export function SelectControl<T extends string>({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly T[];
}) {
  const id = useId();
  return (
    <ControlRow label={label} htmlFor={id}>
      <Select
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onValueChange(next as T);
        }}
      >
        <SelectTrigger
          id={id}
          size="sm"
          className="w-44 max-w-full min-w-0 shrink-0"
        >
          <SelectValue>{value}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ControlRow>
  );
}
