"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const steps = [
  { tab: "Setup", title: "Create or select an examination period", instructions: "Choose an existing draft above, or click New period. Enter the name, semester, exam type, date range, allowed weekdays and daily time slots. Use institution-local time, then click Save period. The academic year is set automatically from the latest student registrations; existing periods keep their saved year.", check: "Check that the saved period and dates are correct before continuing." },
  { tab: "Venues", title: "Prepare examination venues", instructions: "Review the venue table and save each venue’s verified examination capacity. Record any unavailable dates and times, and use Show unavailable intervals to review them. Unconfigured venues are excluded from generation.", check: "Verify examination seating capacity, which can differ from classroom capacity. A capacity email draft must be copied and sent separately." },
  { tab: "Courses", title: "Choose courses and durations", instructions: "Click Load active courses and registration counts. Select the courses to schedule, enter each exam’s duration in minutes, then click Save selected courses.", check: "Review Registered students / required seats in the saved course table. Counts include all registrations for the course, saved year and semester, for every exam type; reload them after registration changes. Once a draft is generated, changing courses or durations requires resetting it." },
  { tab: "Timetable", title: "Generate the draft schedule", instructions: "Click Generate draft. Read the generation outcome and diagnostics. If generation fails, resolve the reported capacity, availability or scheduling problems before trying again.", check: "A COMPLETE outcome means a draft was saved. It has not been published." },
  { tab: "Timetable", title: "Review dates, venues and allocations", instructions: "Check every exam’s date and time, venue bookings and student allocations. Resolve all unallocated students and conflicts. To adjust a placement, select the exam, find valid alternatives, choose its date, time and venues, then click Save placement.", check: "Cancel an exam’s staffing before moving it, then assign invigilators again. Review the reset warning carefully if you need to regenerate." },
  { tab: "Staffing", title: "Assign and review invigilators", instructions: "Click Automatically assign available invigilators, or assign them manually. Select each examination and click Review venue staffing to see required, assigned and missing counts. Fill every shortage with an available invigilator.", check: "Review staffing for every examination and venue before validating publication." },
  { tab: "Publish", title: "Validate the schedule", instructions: "Click Validate publication. Read every reported problem and return to the relevant tab to fix it. Validate again after changes until all publication checks pass.", check: "Publish stays disabled until validation succeeds. Moving through this guide does not complete or validate the actual work." },
  { tab: "Publish", title: "Publish the exam schedule", instructions: "After checking the final schedule and staffing, click Publish timetable and staffing. The server checks the schedule again and publishes the period, examinations and staffing together.", check: "Confirm that the period status becomes PUBLISHED. Published examinations are locked; later changes use Amendments." },
];

export function SchedulingGuide({ busy, published, administratorEmail, onNavigate }: { busy: boolean; published: boolean; administratorEmail: string; onNavigate: (tab: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const current = steps[step];
  const [expert, setExpert] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const preferenceKey = `exam-scheduling-expert:${administratorEmail.trim().toLowerCase()}`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let savedExpert = false;
      try { savedExpert = localStorage.getItem(preferenceKey) === "true"; } catch { /* Default to guided mode when storage is unavailable. */ }
      setExpert(savedExpert);
      setActive(!savedExpert);
      if (!savedExpert) dialog.current?.showModal();
    });
    return () => cancelAnimationFrame(frame);
  }, [preferenceKey]);

  useEffect(() => {
    if (!active || expert) return;
    const target = document.querySelector<HTMLElement>(`[data-guide-tab="${current.tab}"]`);
    if (!target) return;
    target.setAttribute("data-guide-pointer", `Step ${step + 1} ↓`);
    return () => target.removeAttribute("data-guide-pointer");
  }, [active, expert, current.tab, step]);

  function chooseExpert(value: boolean) {
    setExpert(value);
    setActive(!value);
    setStorageWarning("");
    try {
      if (value) localStorage.setItem(preferenceKey, "true");
      else localStorage.removeItem(preferenceKey);
    } catch { setStorageWarning("Your preference could not be saved in this browser. The guide will open again on your next visit."); }
    if (value) dialog.current?.close();
    else { setStep(0); open(); }
  }


  function open() {
    trigger.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    dialog.current?.showModal();
  }
  function navigate(index: number) {
    setStep(index);
    onNavigate(steps[index].tab);
    document.querySelector<HTMLElement>(`[data-guide-tab="${steps[index].tab}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return <section className="rounded-[10px] border border-black/10 bg-white p-5 shadow-sm" aria-label="Scheduling guide">
    {expert && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Expert mode · automatic guidance is off for this account in this browser.</p><Button type="button" variant="ghost" onClick={() => chooseExpert(false)}>Enable guided mode</Button></div>}
    {storageWarning && <p role="status" className="text-sm">{storageWarning}</p>}
    {active && <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
      <p className="text-sm font-semibold" aria-live="polite">Step {step + 1} of {steps.length}: {current.title}</p>
      <p className="text-sm text-muted">{current.instructions}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy || step === 0} onClick={() => navigate(step - 1)}>Previous step</Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => navigate(step)}>Open {current.tab}</Button>
        {step < steps.length - 1 && <Button type="button" size="sm" disabled={busy} onClick={() => navigate(step + 1)}>Next step</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={open}>View step details</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => chooseExpert(true)}>I’m an expert — turn off guidance</Button>
      </div>
      {published && <p role="status" className="text-sm font-semibold">This period is published. Use Amendments for changes, or create a new period to follow the guide again.</p>}
    </div>}
    <dialog ref={dialog} aria-labelledby="scheduling-guide-title" aria-describedby="scheduling-guide-description" onClose={() => trigger.current?.focus()} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-xl bg-white p-6 text-ink shadow-2xl backdrop:bg-black/50">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted">Exam scheduling · Step {step + 1} of {steps.length}</p><h2 id="scheduling-guide-title" className="mt-1 text-xl font-bold">{current.title}</h2></div><Button type="button" variant="ghost" size="sm" onClick={() => dialog.current?.close()}>Continue on page</Button></div>
      <p className="mt-3 text-sm text-muted">Your step-by-step guide opens every time you enter Exam Management unless you choose expert mode.</p>
      <nav aria-label="Guide steps" className="my-5 flex flex-wrap gap-2">{steps.map((item, index) => <button key={item.title} type="button" aria-label={`Step ${index + 1}: ${item.title}`} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)} className={`h-9 w-9 rounded-full border text-sm ${index === step ? "bg-ink text-white" : "border-black/15 hover:bg-surface-muted"}`}>{index + 1}</button>)}</nav>
      <p id="scheduling-guide-description" className="leading-relaxed">{current.instructions}</p>
      <p className="mt-4 rounded-lg bg-surface-muted p-4 text-sm">{current.check}</p>
      <p className="mt-4 text-sm text-muted">Use “Open {current.tab}” to work on this step. The guide never saves, generates or publishes for you.</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>{step < steps.length - 1 && <Button type="button" variant="secondary" onClick={() => setStep(step + 1)}>Next</Button>}<Button type="button" disabled={busy} onClick={() => { setActive(true); navigate(step); dialog.current?.close(); }}>Open {current.tab}</Button></div>
      <Button type="button" variant="ghost" className="mt-4" onClick={() => chooseExpert(true)}>I’m an expert — don’t show this automatically</Button>
      <p className="mt-2 text-xs text-muted">Expert mode is saved for your account in this browser. You can enable guided mode again at any time.</p>
    </dialog>
  </section>;
}
