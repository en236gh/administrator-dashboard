"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Select } from "@/components/ui/select";
import { AmendmentForm } from "@/components/admin/amendment-form";
import { Button } from "@/components/ui/button";
import { schedulingAction } from "@/lib/actions/scheduling";

type Row = Record<string, unknown>;
type Period = Row & { period_id: number; revision: number; status: string; slots: Row[]; courses: Row[]; exams: Row[]; bookings: Row[]; allocations: Row[]; unallocatedStudents: Row[]; assignments: Row[]; conflictingExams: Row[] };
type Placement = {start:string;end:string;venues:number[]};
type Staffing = {venueId:number; requiredInvigilatorCount:number; assignedInvigilatorCount:number; remainingInvigilators:{staffId:number;fullName:string}[]};
type Action = Parameters<typeof schedulingAction>[0];
const field = "rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/30 disabled:bg-surface-muted";
const panel = "exam-panel space-y-5 rounded-2xl border border-black/8 bg-white p-5 shadow-sm sm:p-6";
const workflow = ["Setup", "Timetable", "Staffing", "Publish"];
const descriptions: Record<string, string> = { Setup: "Enter the semester and exam window.", Venues: "Verify room capacity and manage unavailable times.", Timetable: "Review automatically discovered exams, venues and student allocations.", Staffing: "Review automatic assignments and resolve staffing shortages.", Publish: "Resolve validation issues and release the timetable and staffing together.", Requests: "Record decisions here; apply timetable changes in Amendments.", Amendments: "Propose, approve, then apply published timetable changes.", Audit: "Inspect allocation issues and the period’s change history." };

function Table({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-black/15 bg-surface-muted/50 px-4 py-6 text-center text-sm text-muted">No records yet.</p>;
  return <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted"><tr>{columns.map(c=><th scope="col" className="px-4 py-3" key={c}>{({eligible_students:"Students",registered_students:"Students",allocated_students:"Allocated"} as Record<string,string>)[c]??c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr className="border-t border-black/5" key={i}>{columns.map(c=><td className="px-4 py-3" key={c}>{String(r[c]??"—")}</td>)}</tr>)}</tbody></table></div>;
}

export function SchedulingWorkspace() {
  const [periods,setPeriods]=useState<Row[]>([]);
  const [period,setPeriod]=useState<Period|null>(null);
  const [venues,setVenues]=useState<Row[]>([]);
  const [tab,setTab]=useState("Setup");
  const [message,setMessage]=useState("Loading examination periods…");
  const [busy,setBusy]=useState(false);
  const guard=useRef(false);
  const [failure,setFailure]=useState(0);
  const [failedAction,setFailedAction]=useState<Action|null>(null);
  const [outcome,setOutcome]=useState("");
  const [generationDetails,setGenerationDetails]=useState<unknown>(null);
  const [limit,setLimit]=useState(100000);
  const [blockers,setBlockers]=useState<string[]>([]);
  const [validated,setValidated]=useState(false);
  const [alternatives,setAlternatives]=useState<Placement[]>([]);
  const [staffing,setStaffing]=useState<Staffing[]>([]);
  const [exam,setExam]=useState(0);
  const [audit,setAudit]=useState<Row[]>([]);
  const [amendments,setAmendments]=useState<Row[]>([]);
  const [notifications,setNotifications]=useState<Row[]>([]);
  const [requests,setRequests]=useState<Row[]>([]);
  const [lecturers,setLecturers]=useState<Row[]>([]);
  const [draft,setDraft]=useState<{to:string;subject:string;body:string}|null>(null);
  const [capacityCourse,setCapacityCourse]=useState("");
  const [history,setHistory]=useState<Row[]>([]);
  const [unavailable,setUnavailable]=useState<Row[]>([]);
  const [moveDate,setMoveDate]=useState("");
  const [moveTime,setMoveTime]=useState("");
  const [moveVenues,setMoveVenues]=useState<number[]>([]);
  const [newPeriod,setNewPeriod]=useState(false);
  const [creationNeedsRefresh,setCreationNeedsRefresh]=useState(false);
  const editable=!newPeriod && period?.status==="DRAFT";
  const id=period?.period_id??0;

  async function refresh(target=id) {
    setValidated(false);
    const results=await Promise.all([schedulingAction("list"),schedulingAction("venues"),...(target?[schedulingAction("detail",target)]:[])]);
    if (!results[0].ok) throw new Error(results[0].message);
    if (!results[1].ok) throw new Error(results[1].message);
    setPeriods(results[0].data as Row[]); setVenues(results[1].data as Row[]);
    if(target) {
      if(!(results[0].data as Row[]).some(row=>Number(row.period_id)===target)) {setPeriod(null);setTab("Setup");return;}
      if(!results[2].ok) throw new Error(results[2].message);
      setPeriod(results[2].data as Period);

    }
  }
  useEffect(()=> { let active=true; Promise.all([schedulingAction("list"),schedulingAction("venues")]).then(([p,v])=>{
    if(!active)return;
    if(p.ok)setPeriods(p.data as Row[]); if(v.ok)setVenues(v.data as Row[]);
    setMessage(!p.ok?p.message:!v.ok?v.message:"");
    if(!p.ok||!v.ok)setFailure(!p.ok?p.status:v.status);
  });return()=>{active=false;}; },[]);

  async function run(action:Action,body?:unknown,session=exam,venue=0,staff=0,target=id) {
    if(guard.current)return; guard.current=true;setBusy(true);setFailure(0);setFailedAction(null);
    if (["validate","generate","setup","move","publish","autoAssign","assign","cancel","capacity","unavailable","applyAmendment","detail","create"].includes(action)) setValidated(false);
    try {
      const result=await schedulingAction(action,target,body,session,venue,staff);
      setMessage(result.ok ? (["detail","courses","list","venues","staffing","history","audit","requests","amendments","unavailability","alternatives","lecturers"].includes(action) ? "" : "Changes saved.") : result.message);setFailure(result.ok?0:result.status);
      if((action==="generate" || action==="create") && result.data) {
        const data=result.data as {generation:{period:Period;result:{outcome:string;problems:string[]}};staffing:{understaffedVenueIds?:number[]}[];validation:{valid:boolean;problems:string[]}};
        const p=data.generation.period;
        const shortages=(data.staffing??[]).flatMap(s=>s.understaffedVenueIds??[]);
        setGenerationDetails(data.generation.result);setPeriod(p);setNewPeriod(false);setExam(0);setStaffing([]);setAlternatives([]);
        setOutcome(data.generation.result.outcome);
        setBlockers([...data.generation.result.problems,...data.validation.problems,...shortages.map(v=>`Venue #${v} needs more invigilators.`)]);
        setValidated(result.ok && data.validation.valid && !data.validation.problems.length && !shortages.length);
        setPeriods(rows=>[...rows.filter(row=>Number(row.period_id)!==p.period_id),p]);
        setTab("Timetable");
        setMessage(result.ok?"Schedule generated. Review the timetable and staffing before publishing.":result.message);
      } else if(result.ok) {
        if(["detail","setup","move","publish"].includes(action)) {
          const p=result.data as Period;setPeriod(p);setValidated(false);setBlockers([]);setOutcome("");setGenerationDetails(null);
          if(action==="detail") {setExam(0);setStaffing([]);setAlternatives([]);setHistory([]);setRequests([]);setAmendments([]);setNotifications([]);setLecturers([]);setDraft(null);setCapacityCourse("");setNewPeriod(false);}
          setPeriods(rows=>[...rows.filter(row=>Number(row.period_id)!==p.period_id),p]);
        }
        if(action==="amendments")setAmendments(result.data as Row[]);
        if(action==="notifications"||action==="retryNotifications")setNotifications(result.data as Row[]);
        if(["proposeAmendment","decideAmendment","applyAmendment"].includes(action)) {const loaded=await schedulingAction("amendments",id);if(loaded.ok)setAmendments(loaded.data as Row[]);if(action==="applyAmendment")await refresh();setMessage(action==="applyAmendment"?"Approved amendment applied. Check notification delivery status separately.":"Amendment proposal / decision saved. Published timetable unchanged.");}
        if(action==="requests")setRequests(result.data as Row[]);
        if(action==="lecturers")setLecturers(result.data as Row[]);
        if(action==="capacityDraft")setDraft(result.data as {to:string;subject:string;body:string});
        if(action==="request"||action==="decision") {const loaded=await schedulingAction("requests",id);if(loaded.ok)setRequests(loaded.data as Row[]);setMessage("Request / decision recorded. The timetable has not changed.");}
        if(action==="alternatives")setAlternatives(result.data as Placement[]);
        if(action==="staffing")setStaffing(result.data as Staffing[]);
        if(action==="audit")setAudit(result.data as Row[]);
        if(action==="history")setHistory(result.data as Row[]);
        if(action==="unavailability")setUnavailable(result.data as Row[]);
        if(action==="validate") {const data=result.data as {valid:boolean;problems:string[]};setValidated(data.valid && data.problems.length===0);setBlockers(data.problems);setMessage(data.valid && data.problems.length===0?"All publication checks currently pass.":"Publication blocked. Resolve the listed problems.");}
        if(["autoAssign","assign","cancel","capacity","unavailable"].includes(action)) {
          setValidated(false);await refresh();
          if(session) {const s=await schedulingAction("staffing",id,undefined,session);if(s.ok)setStaffing(s.data as Staffing[]);}
        }
      }
      if (!result.ok) {
        if(action==="create" && (result.status>=500 || result.status===409)) {
          setCreationNeedsRefresh(true);
          const listed=await schedulingAction("list");
          if(listed.ok) {setPeriods(listed.data as Row[]);setCreationNeedsRefresh(false);}
        }
        setFailedAction(action);
        setValidated(false);
        const data=result.data as {problems?:string[]}|null;
        if(data?.problems)setBlockers(data.problems);
        if(result.status===409 && action!=="create") {
          try {await refresh(target);} catch {setMessage(`${result.message} Latest status could not be loaded; reload before retrying.`);}
        }
        if(result.status===403) {
          setPeriod(null);setPeriods([]);setVenues([]);
          setStaffing([]);setRequests([]);setAmendments([]);setNotifications([]);
          setHistory([]);setAudit([]);setUnavailable([]);setLecturers([]);setDraft(null);
          setAlternatives([]);setBlockers([]);setOutcome("");setExam(0);
        }
      }
    }catch(e) {setMessage(e instanceof Error?e.message:"Operational failure. Check status before retrying.");setFailure(503);if(action==="create")setCreationNeedsRefresh(true);}
    finally {setBusy(false);guard.current=false;}
  }
  async function checkStatus() {
    if(guard.current)return;guard.current=true;setBusy(true);
    try {await refresh();setCreationNeedsRefresh(false);setFailure(0);setValidated(false);setMessage("Latest period loaded. Review before retrying.");}
    catch(e){setMessage(e instanceof Error?e.message:"Status could not be checked.");}
    finally{setBusy(false);guard.current=false;}
  }
  function setup(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const f=new FormData(e.currentTarget);
    if(String(f.get("endDate"))<String(f.get("startDate"))) {setMessage("End date must be on or after the start date.");setFailure(400);return;}
    if(!f.getAll("day").length) {setMessage("Select at least one examination weekday.");setFailure(400);return;}
    const slots=String(f.get("slots")).split(/\n/).filter(s=>s.trim()).map(s=>{const [startTime,endTime]=s.trim().split(/\s*[-–]\s*/);return {startTime,endTime};});
    if(!slots.length||slots.some(s=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.endTime)||s.endTime<=s.startTime)) {setMessage("Use HH:MM-HH:MM for each daily slot, with the end after the start.");setFailure(400);return;}
    const body={name:f.get("name"),semester:Number(f.get("semester")),examType:f.get("examType"),startDate:f.get("startDate"),endDate:f.get("endDate"),daysOfWeek:f.getAll("day").map(Number),slots};
    if((newPeriod||!period)&&creationNeedsRefresh)return;
    void run(newPeriod||!period?"create":"setup",body,period?.revision??0);
  }
  function chooseExam(value:number) {
    setExam(value);setStaffing([]);setAlternatives([]);
    const row=period?.exams.find(e=>Number(e.exam_session_id)===value);
    setMoveDate(String(row?.exam_date??""));setMoveTime(String(row?.start_time??"").slice(0,5));
    setMoveVenues(period?.bookings.filter(b=>Number(b.exam_session_id)===value).map(b=>Number(b.venue_id))??[]);
  }
  return <div className="exam-management space-y-6">
    <div className={panel}><div className="flex flex-wrap items-center gap-3"><Select aria-label="Examination period" className={field} value={newPeriod?"":id||""} disabled={busy} onChange={e=>{if(e.target.value)void run("detail",undefined,0,0,0,Number(e.target.value));}}><option value="">Choose examination period</option>{periods.map(p=><option key={String(p.period_id)} value={Number(p.period_id)}>#{String(p.period_id)} · {String(p.name)} · Semester {String(p.semester)} · {String(p.exam_type)} · {String(p.status)}</option>)}</Select><Button disabled={busy} onClick={()=>{setNewPeriod(true);setPeriod(null);setValidated(false);setBlockers([]);setRequests([]);setAmendments([]);setNotifications([]);setStaffing([]);setHistory([]);setLecturers([]);setDraft(null);setExam(0);setOutcome("");setGenerationDetails(null);setTab("Setup");}}>New period</Button><Button variant="secondary" disabled={busy} onClick={checkStatus}>Refresh</Button></div>
    {(busy||message)&&<p className={`rounded-xl border px-4 py-3 text-sm ${failure?"border-red-200 bg-red-50 text-red-900":"border-black/5 bg-surface-muted text-ink"}`} role={failure?"alert":"status"} aria-live="polite">{busy?"Working…":message}</p>}
    {failure===409&&failedAction!=="create"&&<p>Revision or timetable conflict. Review the latest period before retrying.</p>}
    {failure===409&&failedAction==="create"&&<p>Review the schedule list and open any existing schedule for this cycle before retrying.</p>}
    {failure===400&&<p>Validation error. Correct the input using the server message above.</p>}
    {failure===403&&<p>Access denied. An active Administrator account is required.</p>}
    {failure>=500&&<p>Refresh to check whether the change was saved before retrying.</p>}
    </div>
    {period&&<section className={panel} aria-label="Selected period summary"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Period #{id}</p><h2 className="mt-1 text-xl font-semibold">{String(period.name)}</h2><p className="mt-1 text-sm text-muted">{String(period.start_date??"—")} – {String(period.end_date??"—")} · Semester {String(period.semester)} · {String(period.exam_type)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${editable?"bg-amber-50 text-amber-900":"bg-emerald-50 text-emerald-900"}`}>{period.status}</span></div></section>}
    <div className="rounded-2xl border border-black/8 bg-white p-4 sm:p-5"><nav className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4" aria-label="Examination workflow">{workflow.map((t,index)=><Button key={t} aria-current={tab===t?"step":undefined} variant={tab===t?"primary":"secondary"} disabled={busy} onClick={()=>setTab(t)}><span aria-hidden="true" className="opacity-60">{index+1}.</span>{t}</Button>)}</nav><nav className="mt-4 flex flex-wrap gap-2 border-t border-black/8 pt-4" aria-label="Review and history">{["Venues","Requests","Amendments","Audit"].map(t=><Button key={t} aria-current={tab===t?"page":undefined} size="sm" variant={tab===t?"primary":"ghost"} disabled={busy} onClick={()=>setTab(t)}>{t}</Button>)}</nav></div>
    <div><h2 className="mt-1 text-xl font-semibold">{tab==="Publish"?"Review and publish":tab}</h2><p className="mt-1 text-sm text-muted">{descriptions[tab]}</p>{!period&&tab!=="Setup"&&tab!=="Venues"&&<p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Select or create an examination period to work on this step.</p>}</div>
    {tab==="Setup"&&<section className={panel}>
      <form key={`${newPeriod?"new":id}`} onSubmit={setup} className="space-y-3"><fieldset disabled={busy||(!newPeriod&&!!period&&(!editable||period.exams.length>0))} className="grid gap-3 md:grid-cols-2">
      <label>Name <input className={field} name="name" required maxLength={120} defaultValue={newPeriod?"":String(period?.name??"")}/></label>
      <label>Semester <Select aria-label="Semester" className={field} name="semester" defaultValue={String(period?.semester??1)}><option>1</option><option>2</option></Select></label>
      <label>Exam type <Select aria-label="Exam type" className={field} name="examType" defaultValue={String(period?.exam_type??"FINAL")}>{["FINAL","SUPPLEMENTARY","SPECIAL"].map(t=><option key={t}>{t}</option>)}</Select></label>
      <label>Start date <input className={field} type="date" name="startDate" required defaultValue={newPeriod?"":String(period?.start_date??"")}/></label>
      <label>End date <input className={field} type="date" name="endDate" required defaultValue={newPeriod?"":String(period?.end_date??"")}/></label>
      <div className="space-y-3"><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={e=>e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="day"]').forEach(input=>{input.checked=true;})}>Select all days</Button><Button type="button" size="sm" variant="ghost" onClick={e=>e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="day"]').forEach(input=>{input.checked=false;})}>Clear days</Button></div>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d,i)=><label className="mr-3 inline-flex items-center gap-2" key={d}><input type="checkbox" name="day" value={i+1} defaultChecked={!newPeriod&&period?period.slots.some(s=>Number(s.day_of_week)===i+1):i<5}/> {d}</label>)}</div>
      <label>Daily slots (HH:MM-HH:MM per line)<textarea className={`${field} block w-full`} name="slots" required defaultValue={!newPeriod&&period?[...new Set(period.slots.map(s=>`${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`))].join("\n"):"09:00-11:00\n11:00-13:00"}/></label>
      <Button type="submit" disabled={(newPeriod||!period)&&creationNeedsRefresh}>{newPeriod||!period?"Generate schedule":"Save setup"}</Button></fieldset></form>
      {editable&&!!period?.exams.length&&<p>Review placements in Timetable. Setup can only be edited before exams are generated.</p>}
    </section>}
    {tab==="Venues"&&<section className={panel}>
      {period&&<details className="rounded-xl border border-black/10 p-4"><summary className="cursor-pointer text-sm font-medium">Request capacity confirmation</summary><div className="mt-4 space-y-3"><label>Selected course <Select aria-label="Selected course" className={field} value={capacityCourse} onChange={e=>{setCapacityCourse(e.target.value);setLecturers([]);setDraft(null);}}><option value="">Select course</option>{period.courses.map(c=><option key={String(c.course_code)}>{String(c.course_code)}</option>)}</Select></label> <Button disabled={busy||!capacityCourse} onClick={()=>run("lecturers",capacityCourse)}>Request examination capacity</Button>

      {!!lecturers.length&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("capacityDraft",{periodId:id,courseCode:capacityCourse,venueId:Number(f.get("venue")),lecturerStaffId:Number(f.get("lecturer"))});}}><label>Assigned lecturer <Select aria-label="Assigned lecturer" className={field} name="lecturer" required defaultValue=""><option value="">Choose lecturer explicitly</option>{lecturers.map(l=><option key={String(l.staff_id)} value={Number(l.staff_id)}>{String(l.full_name)} — {String(l.email)}</option>)}</Select></label> <label>Venue <Select aria-label="Venue" className={field} name="venue" required>{venues.map(v=><option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</Select></label> <Button disabled={busy}>Prepare email draft</Button></form>}
      {draft&&<div><p>Copy and send this draft to request capacity.</p><label>To <input className={field} readOnly value={draft.to}/></label><label>Subject <input className={`${field} w-full`} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label><label>Message <textarea className={`${field} w-full`} rows={7} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label><Button variant="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);setMessage("Draft copied. No delivery has occurred.");}catch{setMessage("Clipboard unavailable. Select and copy the draft text manually.");}}}>Copy draft</Button></div>}</div></details>}
      <Table rows={venues} columns={["venue_id","venue_name","capacity","examination_capacity"]}/>
      <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("capacity",{examinationCapacity:Number(f.get("capacity"))},0,Number(f.get("venue")));}}><label>Venue <Select aria-label="Venue" className={field} name="venue" required>{venues.map(v=><option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</Select></label><label>Verified exam seats <input className={field} type="number" min={1} name="capacity" required/></label><Button disabled={busy}>Save verified capacity</Button></form>
      <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("unavailable",{startsAt:f.get("startsAt"),endsAt:f.get("endsAt"),reason:f.get("reason")},0,Number(f.get("venue")));}}><label>Venue <Select aria-label="Venue" className={field} name="venue" required>{venues.map(v=><option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</Select></label><label>Unavailable from <input className={field} type="datetime-local" name="startsAt" required/></label><label>Until <input className={field} type="datetime-local" name="endsAt" required/></label><label>Reason <input className={field} name="reason" maxLength={500} required/></label><Button disabled={busy}>Record unavailability</Button></form>
      <Button variant="secondary" disabled={busy} onClick={()=>run("unavailability")}>Show unavailable intervals</Button><Table rows={unavailable} columns={["venue_id","starts_at","ends_at","reason"]}/>
    </section>}
    {tab==="Timetable"&&<section className={panel}>
      <details><summary className="cursor-pointer text-sm text-muted">Advanced options</summary><label>Search limit <input className={field} type="number" min={1} max={1000000} value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label></details> <Button disabled={busy||!editable||limit<1||limit>1000000} onClick={()=>run("generate",{revision:period?.revision,searchLimit:limit})}>Regenerate schedule</Button>
      {outcome&&<p role="status">Generation outcome: {outcome}</p>}
      {generationDetails!=null&&<details><summary>Generation diagnostics</summary><pre className="overflow-auto whitespace-pre-wrap text-sm">{JSON.stringify(generationDetails,null,2)}</pre></details>}
      {outcome==="SEARCH_LIMIT_REACHED"&&<div><p>Increase the search limit or adjust dates and venues.</p><Button disabled={busy||!editable||limit>=1000000} onClick={()=>{const next=Math.min(1000000,limit*2);setLimit(next);void run("generate",{revision:period?.revision,searchLimit:next});}}>Try again with a higher search limit</Button></div>}
      {outcome==="NO_FEASIBLE_ARRANGEMENT"&&<p>Add venue capacity or adjust dates and time slots.</p>}
      {!!period?.conflictingExams?.length&&<div><h3>Existing examinations for selected courses and cycle</h3><Table rows={period.conflictingExams} columns={["exam_session_id","course_code","schedule_published","status","attendance_records","incident_records","report_records","staffing_records","allocation_records","booking_records"]}/><p>Correct the conflicting records or exam cycle before regenerating.</p>{period.conflictingExams.map(e=><div key={String(e.exam_session_id)}><a className="underline" href={`/examinations?examSessionId=${e.exam_session_id}`}>View {String(e.course_code)}</a></div>)}</div>}
      <details><summary>Discovered courses</summary><Table rows={period?.courses??[]} columns={["course_code","duration_minutes","eligible_students"]}/></details>
      <Table rows={period?.exams??[]} columns={["exam_session_id","course_code","exam_date","start_time","end_time","registered_students","allocated_students"]}/>
      <Table rows={period?.bookings??[]} columns={["exam_session_id","venue_id","venue_name","examination_capacity","allocated_students"]}/>
      <details className="rounded-xl border border-black/10 p-4"><summary className="cursor-pointer font-medium">Review {period?.allocations.length??0} student allocations</summary><Table rows={period?.allocations??[]} columns={["exam_session_id","computer_number","full_name","venue_id"]}/></details>
      {!!period?.unallocatedStudents.length&&<><h3 className="font-medium">Unallocated students</h3><Table rows={period.unallocatedStudents} columns={["course_code","computer_number"]}/></>}
      <label>Examination <Select aria-label="Examination" className={field} value={exam||""} onChange={e=>chooseExam(Number(e.target.value))}><option value="">Select exam</option>{period?.exams.map(e=><option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)}</option>)}</Select></label>
      {exam>0&&<><Button variant="secondary" disabled={busy||!editable} onClick={()=>run("alternatives")}>Find valid alternatives</Button>{alternatives.map((p,i)=><Button variant="secondary" disabled={!editable} key={i} onClick={()=>{setMoveDate(p.start.slice(0,10));setMoveTime(p.start.slice(11,16));setMoveVenues(p.venues);}}>{p.start.replace("T"," ")} · venues {p.venues.join(", ")}</Button>)}
      <form onSubmit={e=>{e.preventDefault();void run("move",{revision:period?.revision,examDate:moveDate,startTime:moveTime,venueIds:moveVenues});}}><fieldset disabled={!editable||busy} className="space-y-3"><p>Cancel staffing before moving this exam; reassign afterwards.</p><label>Date <input className={field} type="date" required value={moveDate} onChange={e=>setMoveDate(e.target.value)}/></label> <label>Start <input className={field} type="time" required value={moveTime} onChange={e=>setMoveTime(e.target.value)}/></label><div className="space-y-3"><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={()=>setMoveVenues(venues.map(v=>Number(v.venue_id)))}>Select all venues</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setMoveVenues([])}>Clear venues</Button></div>{venues.map(v=><label className="mr-3" key={String(v.venue_id)}><input type="checkbox" checked={moveVenues.includes(Number(v.venue_id))} onChange={e=>setMoveVenues(s=>e.target.checked?[...s,Number(v.venue_id)]:s.filter(n=>n!==Number(v.venue_id)))}/> {String(v.venue_name)}</label>)}</div><Button disabled={!moveVenues.length}>Save placement</Button></fieldset></form></>}
    </section>}
    {tab==="Staffing"&&<section className={panel}>
      <Button disabled={busy||!editable||!period?.exams.length} onClick={()=>run("autoAssign")}>Fill staffing shortages</Button>
      <label>Examination <Select aria-label="Examination" className={field} value={exam||""} onChange={e=>chooseExam(Number(e.target.value))}><option value="">Select exam</option>{period?.exams.map(e=><option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)}</option>)}</Select></label> <Button variant="secondary" disabled={busy||!exam} onClick={()=>run("staffing")}>Review venue staffing</Button>

      {staffing.map(s=><div key={s.venueId}><p>Venue #{s.venueId}: required {s.requiredInvigilatorCount}, assigned {s.assignedInvigilatorCount}, missing {Math.max(0,s.requiredInvigilatorCount-s.assignedInvigilatorCount)}</p><form onSubmit={e=>{e.preventDefault();void run("assign",{examSessionId:exam,venueId:s.venueId,staffId:Number(new FormData(e.currentTarget).get("staff"))});}}><Select aria-label={`Available invigilator for venue ${s.venueId}`} className={field} name="staff" required>{s.remainingInvigilators.map(a=><option key={a.staffId} value={a.staffId}>{a.fullName}</option>)}</Select> <Button disabled={!editable||busy||!s.remainingInvigilators.length}>Assign invigilator</Button></form></div>)}
      <Table rows={period?.assignments??[]} columns={["exam_session_id","venue_id","staff_id","assignment_status"]}/>
      {editable&&period?.assignments.map(a=><Button variant="secondary" disabled={busy} key={`${a.exam_session_id}/${a.venue_id}/${a.staff_id}`} onClick={()=>run("cancel",undefined,Number(a.exam_session_id),Number(a.venue_id),Number(a.staff_id))}>Cancel duty: exam {String(a.exam_session_id)}, venue {String(a.venue_id)}, staff {String(a.staff_id)}</Button>)}
    </section>}
    {tab==="Publish"&&<section className={panel}><Button variant="secondary" disabled={busy||!period} onClick={()=>run("validate")}>Validate publication</Button> <Button disabled={busy||!editable||!validated} onClick={()=>run("publish",{revision:period?.revision})}>Publish timetable and staffing</Button></section>}
    {blockers.length>0&&<div className={panel} role="alert"><ul className="list-disc pl-5">{blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
    {tab==="Requests"&&<section className={panel}><Button disabled={busy||!period} onClick={()=>run("requests")}>Load change requests</Button>
      <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("request",{periodId:id,courseCode:f.get("course"),examSessionId:f.get("exam")?Number(f.get("exam")):null,proposedChange:f.get("proposal"),reason:f.get("reason")});}}><fieldset disabled={busy||!period} className="space-y-3"><label>Course <Select aria-label="Course" className={field} name="course" required>{period?.courses.map(c=><option key={String(c.course_code)}>{String(c.course_code)}</option>)}</Select></label> <label>Exam (optional) <Select aria-label="Exam (optional)" className={field} name="exam"><option value="">Course-wide</option>{period?.exams.map(e=><option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)} #{String(e.exam_session_id)}</option>)}</Select></label><label className="block">Proposed change <textarea className={`${field} w-full`} name="proposal" required maxLength={4000}/></label><label className="block">Reason <textarea className={`${field} w-full`} name="reason" required maxLength={2000}/></label><Button>Submit change request</Button></fieldset></form>
      <Table rows={requests} columns={["request_id","requester_staff_id","course_code","exam_session_id","proposed_change","reason","status","decision"]}/>
      {period&&requests.filter(q=>q.status==="PENDING").map(q=><form key={String(q.request_id)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("decision",{status:f.get("status"),decision:f.get("decision")},Number(q.request_id));}}><p>Review request #{String(q.request_id)}</p><Select aria-label="Decision" className={field} name="status"><option>APPROVED</option><option>REJECTED</option></Select> <label>Decision reason <input className={field} name="decision" required maxLength={2000}/></label> <Button disabled={busy}>Record decision</Button></form>)}
    </section>}
    {tab==="Amendments"&&<section className={panel}>
      <Button disabled={busy||!period} onClick={()=>run("amendments")}>Load amendments</Button>
      <AmendmentForm key={id} revision={period?.revision??0} exams={period?.exams??[]} venues={venues} disabled={busy||period?.status!=="PUBLISHED"} onSubmit={proposal=>void run("proposeAmendment",proposal)}/>
      <Table rows={amendments} columns={["amendment_id","exam_session_id","expected_revision","exam_date","start_time","end_time","reason","status","reviewed_by_staff_id","decision","applied_at"]}/>
      {amendments.map(a=><div key={String(a.amendment_id)} className="space-y-3 border-t pt-3"><p>Amendment #{String(a.amendment_id)}</p>
        <p>Proposed venues: {Array.isArray(a.venueIds)?a.venueIds.join(", "):"Retained"}</p>
        <h3 className="font-medium">Proposed duties</h3><Table rows={Array.isArray(a.duties)?a.duties as Row[]:[]} columns={["venue_id","staff_id"]}/>
        <details><summary>Review proposed student allocations</summary><Table rows={Array.isArray(a.allocations)?a.allocations as Row[]:[]} columns={["computer_number","venue_id"]}/></details>
        {a.status==="APPLIED"&&<div className="grid gap-4 lg:grid-cols-2"><Arrangement title="Before amendment" value={a.before_arrangement}/><Arrangement title="After amendment" value={a.after_arrangement}/></div>}
        {period&&a.status==="PENDING"&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("decideAmendment",{status:f.get("status"),reason:f.get("reason")},Number(a.amendment_id));}}><Select aria-label="Decision" className={field} name="status"><option>APPROVED</option><option>REJECTED</option></Select> <label>Review reason <input className={field} name="reason" required maxLength={2000}/></label> <Button disabled={busy}>Record amendment decision</Button></form>}{period&&a.status==="APPROVED"&&<Button disabled={busy} onClick={()=>run("applyAmendment",{},Number(a.amendment_id))}>Apply amendment</Button>}{a.status==="APPLIED"&&<><Button variant="secondary" disabled={busy} onClick={()=>run("notifications",undefined,Number(a.amendment_id))}>Check notification delivery</Button> <Button variant="secondary" disabled={busy||!period} onClick={()=>run("retryNotifications",{},Number(a.amendment_id))}>Retry inbox delivery only</Button></>}</div>)}

      <Table rows={notifications} columns={["recipient_kind","recipient_id","delivery_status","attempts","available_at","read_at","last_error"]}/>
    </section>}
    {tab==="Audit"&&<section className={panel}><Button disabled={busy} onClick={()=>run("audit")}>Load allocation audit</Button><Table rows={audit} columns={["computer_number","exam_session_id","venue_id","course_code","issue"]}/><Button disabled={busy||!period} onClick={()=>run("history")}>Load period change history</Button><Table rows={history.map(h=>({...h,before_record:JSON.stringify(h.before_record),after_record:JSON.stringify(h.after_record)}))} columns={["occurred_at","actor_staff_id","action","entity","before_record","after_record"]}/></section>}
    {workflow.includes(tab)&&<footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white p-4"><div className="flex gap-2">{workflow.indexOf(tab)>0&&<Button variant="secondary" disabled={busy} onClick={()=>setTab(workflow[workflow.indexOf(tab)-1])}>Previous</Button>}{workflow.indexOf(tab)<workflow.length-1&&<Button disabled={busy||!period} onClick={()=>setTab(workflow[workflow.indexOf(tab)+1])}>Continue to {workflow[workflow.indexOf(tab)+1]}</Button>}</div></footer>}
  </div>;
}

function Arrangement({title,value}:{title:string;value:unknown}) {
  let parsed=value;
  // JDBC JSONB values may arrive as JSON text, a value wrapper, or an object.
  if(parsed && typeof parsed==="object" && "value" in parsed)parsed=parsed.value;
  if(typeof parsed==="string") {try {parsed=JSON.parse(parsed);}catch {return <p>{title}: Snapshot unavailable.</p>;}}
  if(!parsed || typeof parsed!=="object")return <p>{title}: No snapshot available.</p>;
  const snapshot=parsed as Record<string,unknown>;
  return <section className="space-y-2 rounded border p-3"><h3 className="font-semibold">{title}</h3>
    <Table rows={snapshot.exam?[snapshot.exam as Row]:[]} columns={["course_code","exam_date","start_time","end_time"]}/>
    {["bookings","allocations","assignments"].map(key=><details key={key}><summary>{key}</summary><Table rows={Array.isArray(snapshot[key])?snapshot[key] as Row[]:[]} columns={key==="bookings"?["venue_id"]:key==="allocations"?["computer_number","venue_id"]:["venue_id","staff_id","assignment_status"]}/></details>)}
  </section>;
}
