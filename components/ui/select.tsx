"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from "react";

function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}

/** Styled single-select; the hidden native control preserves form submission and validation. */
export function Select({ children, value, defaultValue, onChange, className = "", disabled, required, name, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = Children.toArray(children).filter(isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>).map(child => ({
    value: String(child.props.value ?? text(child.props.children)), label: text(child.props.children), disabled: child.props.disabled,
  }));
  const [local, setLocal] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selected = String(value ?? (options.some(option => option.value === local) ? local : options[0]?.value ?? ""));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const filtered = options.filter(option => option.label.toLowerCase().includes(query.toLowerCase()));
  const enabled = filtered.filter(option => !option.disabled);
  const activeOption = enabled[Math.min(active, Math.max(0, enabled.length - 1))];
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeOption?.value}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeOption?.value, listId]);
  function choose(next: string) {
    if (!native.current || trigger.current?.matches(":disabled")) return;
    native.current.value = next;
    setLocal(next); setInvalid(false); setOpen(false);
    onChange?.({ target: native.current, currentTarget: native.current } as ChangeEvent<HTMLSelectElement>);
    trigger.current?.focus();
  }
  return <span ref={root} className="ui-select relative inline-block min-w-0 max-w-full w-full sm:min-w-48 sm:w-auto" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <select {...props} ref={native} name={name} required={required} disabled={disabled} value={selected} tabIndex={-1} aria-hidden="true" className="sr-only pointer-events-none" onChange={event => { setLocal(event.target.value); onChange?.(event); }} onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }}>{children}</select>
    <button ref={trigger} id={props.id ? `${props.id}-trigger` : undefined} type="button" disabled={disabled} aria-label={props["aria-label"]} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-describedby={invalid ? `${listId}-error` : props["aria-describedby"]} className={`${className} flex min-h-11 w-full items-center justify-between gap-4 text-left font-normal disabled:cursor-not-allowed disabled:opacity-50 ${invalid ? "ring-2 ring-red-500" : ""}`} onClick={() => { setQuery(""); setActive(0); setOpen(!open); }} onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setQuery(""); setActive(0); setOpen(true); } }}>
      <span className="truncate">{options.find(option => option.value === selected)?.label || "Choose an option"}</span><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {invalid && <span id={`${listId}-error`} role="alert" className="mt-1 block text-xs text-red-700">Choose an option.</span>}
    {open && !disabled && <span className="absolute left-0 top-full z-50 mt-2 block w-full min-w-56 max-w-[calc(100vw-3rem)] rounded-xl border border-black/10 bg-white p-2 shadow-xl" onClick={event => event.stopPropagation()}>
      <input ref={search} role="combobox" aria-label={`Search ${props["aria-label"] ?? name ?? "options"}`} aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined} autoComplete="off" placeholder="Search…" value={query} className="mb-2 w-full rounded-lg border border-black/10 bg-surface-muted px-3 py-2 text-sm font-normal outline-none" onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, Math.min(enabled.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Home" || event.key === "End") { event.preventDefault(); setActive(event.key === "Home" ? 0 : Math.max(0, enabled.length - 1)); }
        if (event.key === "Enter") { event.preventDefault(); if (activeOption) choose(activeOption.value); }
      }}/>
      <span id={listId} role="listbox" aria-label={props["aria-label"] ?? name ?? "Options"} className="block max-h-60 overflow-y-auto">
        {filtered.map(option => <span key={option.value} id={`${listId}-${option.value}`} role="option" aria-selected={option.value === selected} aria-disabled={option.disabled || undefined} onMouseDown={event => event.preventDefault()} onClick={() => { if (!option.disabled) choose(option.value); }} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-normal ${option.disabled ? "cursor-not-allowed opacity-40" : option === activeOption ? "bg-surface-muted text-ink" : "hover:bg-surface-muted"}`}><span>{option.label}</span>{option.value === selected && <span aria-hidden="true">✓</span>}</span>)}
        {!filtered.length && <span className="block px-3 py-5 text-center text-sm text-muted">No matches</span>}
      </span>
    </span>}
  </span>;
}
