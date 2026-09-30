"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type Row = Record<string, unknown>;
export type AmendmentProposal = {
  revision: number;
  examSessionId: number;
  examDate: string;
  startTime: string;
  reason: string;
  venueIds?: number[];
  duties?: { venueId: number; staffId: number }[];
};
const field = "rounded border border-black/15 bg-white px-3 py-2 text-sm";

export function AmendmentForm({ revision, exams, venues, disabled, onSubmit }: {
  revision: number; exams: Row[]; venues: Row[]; disabled: boolean;
  onSubmit: (proposal: AmendmentProposal) => void;
}) {
  const [changeVenues, setChangeVenues] = useState(false);
  const [changeDuties, setChangeDuties] = useState(false);
  const [duties, setDuties] = useState([{ venueId: "", staffId: "" }]);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const venueIds = data.getAll("venue").map(Number);
    if (changeVenues && !venueIds.length) { setError("Select at least one proposed venue."); return; }
    setError("");
    onSubmit({
      revision, examSessionId: Number(data.get("exam")), examDate: String(data.get("date")),
      startTime: String(data.get("time")), reason: String(data.get("reason")),
      ...(changeVenues ? { venueIds } : {}),
      ...(changeDuties ? { duties: duties.map(d => ({ venueId: Number(d.venueId), staffId: Number(d.staffId) })) } : {}),
    });
  }
  return <form onSubmit={submit}><fieldset disabled={disabled} className="space-y-3">
    <label>Examination <select className={field} name="exam" required>{exams.map(e => <option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)}</option>)}</select></label>
    <label className="block">Proposed date <input className={field} name="date" type="date" required /></label>
    <label className="block">Start time <input className={field} name="time" type="time" required /></label>
    <label className="block"><input type="checkbox" checked={changeVenues} onChange={e => setChangeVenues(e.target.checked)} /> Replace the retained venue set</label>
    {changeVenues && <div className="space-y-2"><p>Select the complete proposed venue set. Student allocations are recalculated and validated by the server.</p>{venues.map(v => <label className="block" key={String(v.venue_id)}><input type="checkbox" name="venue" value={Number(v.venue_id)} /> {String(v.venue_name)} · exam seats {String(v.examination_capacity ?? "unverified")}</label>)}</div>}
    <label className="block"><input type="checkbox" checked={changeDuties} onChange={e => setChangeDuties(e.target.checked)} /> Replace the retained invigilator duties</label>
    {changeDuties && <div className="space-y-2"><p>Enter the complete proposed duty set. The server checks staff eligibility, availability and venue staffing requirements.</p>{duties.map((d, i) => <div className="flex flex-wrap gap-2" key={i}>
      <label>Duty venue <select className={field} required value={d.venueId} onChange={e => setDuties(rows => rows.map((row, n) => n === i ? { ...row, venueId: e.target.value } : row))}><option value="">Select venue</option>{venues.map(v => <option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</select></label>
      <label>Staff ID <input className={field} type="number" min={1} required value={d.staffId} onChange={e => setDuties(rows => rows.map((row, n) => n === i ? { ...row, staffId: e.target.value } : row))} /></label>
      <Button type="button" variant="secondary" disabled={duties.length === 1} onClick={() => setDuties(rows => rows.filter((_, n) => n !== i))}>Remove duty</Button>
    </div>)}<Button type="button" variant="secondary" onClick={() => setDuties(rows => [...rows, { venueId: "", staffId: "" }])}>Add duty</Button></div>}
    <label className="block">Reason <textarea className={`${field} w-full`} name="reason" maxLength={2000} required /></label>
    {error && <p role="alert">{error}</p>}
    <Button>Propose amendment</Button>
  </fieldset></form>;
}
