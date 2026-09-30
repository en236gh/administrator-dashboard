"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SchedulingGuide } from "@/components/admin/scheduling-guide";
import { AmendmentForm } from "@/components/admin/amendment-form";
import { Button } from "@/components/ui/button";
import { schedulingAction } from "@/lib/actions/scheduling";

type Row = Record<string, unknown>;
type Period = Row & { period_id: number; revision: number; status: string; slots: Row[]; courses: Row[]; exams: Row[]; bookings: Row[]; allocations: Row[]; unallocatedStudents: Row[]; assignments: Row[]; conflictingExams: Row[] };
type Placement = {start:string;end:string;venues:number[]};
type Staffing = {venueId:number; requiredInvigilatorCount:number; assignedInvigilatorCount:number; remainingInvigilators:{staffId:number;fullName:string}[]};
type Action = Parameters<typeof schedulingAction>[0];
const field = "rounded border border-black/15 bg-white px-3 py-2 text-sm";
const panel = "space-y-4 rounded-[10px] bg-white p-5 shadow-sm";

function Table({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (!rows.length) return <p className="text-sm text-muted">No records to show.</p>;
  return <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{columns.map(c=><th className="p-2" key={c}>{({eligible_students:"Registered students / required seats",registered_students:"Registered students / required seats",allocated_students:"Allocated students"} as Record<string,string>)[c]??c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr className="border-t border-black/5" key={i}>{columns.map(c=><td className="p-2" key={c}>{String(r[c]??"—")}</td>)}</tr>)}</tbody></table></div>;
}

export function SchedulingWorkspace({ administratorEmail = "" }: { administratorEmail?: string } = {}) {
  const [periods,setPeriods]=useState<Row[]>([]);
  const [period,setPeriod]=useState<Period|null>(null);
  const [venues,setVenues]=useState<Row[]>([]);
  const [catalog,setCatalog]=useState<Row[]>([]);
  const [selection,setSelection]=useState<Record<string,number>>({});
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
  const [resetReview,setResetReview]=useState(false);
  const [newPeriod,setNewPeriod]=useState(false);
  const editable=!newPeriod && period?.status==="DRAFT";
  const id=period?.period_id??0;

  async function refresh(target=id) {
    setValidated(false);
    const results=await Promise.all([schedulingAction("list"),schedulingAction("venues"),...(target?[schedulingAction("detail",target)]:[])]);
    if (!results[0].ok) throw new Error(results[0].message);
    if (!results[1].ok) throw new Error(results[1].message);
    setPeriods(results[0].data as Row[]); setVenues(results[1].data as Row[]);
    if(target) {
      if(!results[2].ok) throw new Error(results[2].message);
      setPeriod(results[2].data as Period);
      if(catalog.length) {
        const courses=await schedulingAction("courses",target);
        if(!courses.ok) throw new Error(courses.message);
        setCatalog(courses.data as Row[]);
      }
    }
  }
  useEffect(()=> { let active=true; Promise.all([schedulingAction("list"),schedulingAction("venues")]).then(([p,v])=>{
    if(!active)return;
    if(p.ok)setPeriods(p.data as Row[]); if(v.ok)setVenues(v.data as Row[]);
    setMessage(!p.ok?p.message:!v.ok?v.message:"Select an existing period or create a new one.");
    if(!p.ok||!v.ok)setFailure(!p.ok?p.status:v.status);
  });return()=>{active=false;}; },[]);

  async function run(action:Action,body?:unknown,session=exam,venue=0,staff=0,target=id) {
    if(guard.current)return; guard.current=true;setBusy(true);setFailure(0);setFailedAction(null);
    if (["validate","generate","setup","select","move","reset","publish","autoAssign","assign","cancel","capacity","unavailable","applyAmendment","detail","create"].includes(action)) setValidated(false);
    try {
      const result=await schedulingAction(action,target,body,session,venue,staff);
      setMessage(result.message);setFailure(result.ok?0:result.status);
      if(action==="generate" && result.data) {
        const data=result.data as {period:Period;result:{outcome:string;problems:string[]}};
        setGenerationDetails(data.result);setPeriod(data.period);setOutcome(data.result.outcome);setBlockers(data.result.problems);setValidated(false);
        setMessage(data.result.outcome==="COMPLETE"?"Complete draft saved. Review allocations and assign invigilators before publishing.":`${result.message} ${data.result.outcome}: ${data.result.problems.join(" ")}`);
      } else if(result.ok) {
        if(["detail","create","setup","select","move","reset","publish"].includes(action)) {
          const p=result.data as Period;setPeriod(p);setValidated(false);setBlockers([]);setOutcome("");setGenerationDetails(null);
          if(["detail","create"].includes(action)) {setCatalog([]);setResetReview(false);setSelection(Object.fromEntries(p.courses.map(c=>[String(c.course_code),Number(c.duration_minutes)])));setExam(0);setStaffing([]);setAlternatives([]);setHistory([]);setRequests([]);setAmendments([]);setNotifications([]);setLecturers([]);setDraft(null);setCapacityCourse("");setNewPeriod(false);}
          setPeriods(rows=>[...rows.filter(row=>Number(row.period_id)!==p.period_id),p]);
          if(action==="reset") {setExam(0);setStaffing([]);setAlternatives([]);setMoveDate("");setMoveTime("");setMoveVenues([]);}
          if(action==="create")await refresh(p.period_id);
        }
        if(action==="amendments")setAmendments(result.data as Row[]);
        if(action==="notifications"||action==="retryNotifications")setNotifications(result.data as Row[]);
        if(["proposeAmendment","decideAmendment","applyAmendment"].includes(action)) {const loaded=await schedulingAction("amendments",id);if(loaded.ok)setAmendments(loaded.data as Row[]);if(action==="applyAmendment")await refresh();setMessage(action==="applyAmendment"?"Approved amendment applied. Check notification delivery status separately.":"Amendment proposal / decision saved. Published timetable unchanged.");}
        if(action==="requests")setRequests(result.data as Row[]);
        if(action==="lecturers")setLecturers(result.data as Row[]);
        if(action==="capacityDraft")setDraft(result.data as {to:string;subject:string;body:string});
        if(action==="request"||action==="decision") {const loaded=await schedulingAction("requests",id);if(loaded.ok)setRequests(loaded.data as Row[]);setMessage("Request / decision recorded. The timetable has not changed.");}
        if(action==="courses")setCatalog(result.data as Row[]);
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
        setFailedAction(action);
        setValidated(false);
        const data=result.data as {problems?:string[]}|null;
        if(data?.problems)setBlockers(data.problems);
        if(result.status===409 && action!=="create") {
          try {await refresh(target);} catch {setMessage(`${result.message} Latest status could not be loaded; reload before retrying.`);}
        }
        if(result.status===403) {
          setPeriod(null);setPeriods([]);setVenues([]);setCatalog([]);setSelection({});
          setStaffing([]);setRequests([]);setAmendments([]);setNotifications([]);
          setHistory([]);setAudit([]);setUnavailable([]);setLecturers([]);setDraft(null);
          setAlternatives([]);setBlockers([]);setOutcome("");setExam(0);
        }
      }
    }catch(e) {setMessage(e instanceof Error?e.message:"Operational failure. Check status before retrying.");setFailure(503);}
    finally {setBusy(false);guard.current=false;}
  }
  async function checkStatus() {
    if(guard.current)return;guard.current=true;setBusy(true);
    try {await refresh();setFailure(0);setValidated(false);setMessage("Latest saved status loaded. Compare its revision and records with your retained input before retrying.");}
    catch(e){setMessage(e instanceof Error?e.message:"Status could not be checked.");}
    finally{setBusy(false);guard.current=false;}
  }
  function setup(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const f=new FormData(e.currentTarget);
    const slots=String(f.get("slots")).split(/\n/).filter(s=>s.trim()).map(s=>{const [startTime,endTime]=s.trim().split(/\s*[-–]\s*/);return {startTime,endTime};});
    const body={name:f.get("name"),semester:Number(f.get("semester")),examType:f.get("examType"),startDate:f.get("startDate"),endDate:f.get("endDate"),daysOfWeek:f.getAll("day").map(Number),slots};
    void run(newPeriod||!period?"create":"setup",body,period?.revision??0);
  }
  function chooseExam(value:number) {
    setExam(value);setStaffing([]);setAlternatives([]);
    const row=period?.exams.find(e=>Number(e.exam_session_id)===value);
    setMoveDate(String(row?.exam_date??""));setMoveTime(String(row?.start_time??"").slice(0,5));
    setMoveVenues(period?.bookings.filter(b=>Number(b.exam_session_id)===value).map(b=>Number(b.venue_id))??[]);
  }
  return <div className="space-y-5">
    <SchedulingGuide administratorEmail={administratorEmail} busy={busy} published={period?.status==="PUBLISHED"} onNavigate={setTab}/>
    <div className={panel}><div className="flex flex-wrap gap-3"><select aria-label="Examination period" className={field} value={newPeriod?"":id||""} disabled={busy} onChange={e=>{if(e.target.value)void run("detail",undefined,0,0,0,Number(e.target.value));}}><option value="">Choose examination period</option>{periods.map(p=><option key={String(p.period_id)} value={Number(p.period_id)}>{String(p.name)} · {String(p.academic_year)} · {String(p.status)}</option>)}</select><Button disabled={busy} onClick={()=>{setNewPeriod(true);setPeriod(null);setValidated(false);setBlockers([]);setCatalog([]);setRequests([]);setAmendments([]);setNotifications([]);setStaffing([]);setHistory([]);setLecturers([]);setDraft(null);setExam(0);setOutcome("");setGenerationDetails(null);setTab("Setup");}}>New period</Button><Button variant="secondary" disabled={busy} onClick={checkStatus}>Check status / reload</Button></div>
    <p role="status" aria-live="polite">{busy?"Working…":message}</p>
    {failure===409&&failedAction!=="create"&&<p>Revision or timetable conflict. Reload the latest version and compare before reapplying your change. Your form input is retained.</p>}
    {failure===409&&failedAction==="create"&&<p>Period creation was blocked. Resolve the server message above before trying again. The academic year comes from student registrations.</p>}
    {failure===400&&<p>Validation error. Correct the input using the server message above.</p>}
    {failure===403&&<p>Access denied. An active Administrator account is required.</p>}
    {failure>=500&&<p>The saved outcome is uncertain. Check status before retrying; no mutation is retried automatically.</p>}
    {period&&!newPeriod&&<p className="text-sm">{String(period.name)} · academic year {String(period.academic_year??"—")} · revision {period.revision} · {String(period.timezone)} · {period.status==="PUBLISHED"?"Published — use Amendments for changes":"Administrator draft workflow"}</p>}
    </div>
    <Table rows={periods} columns={["name","academic_year","semester","exam_type","start_date","end_date","status","revision","published_at"]}/>
    <nav className="flex flex-wrap gap-2" aria-label="Examination workflow">{["Setup","Courses","Venues","Timetable","Staffing","Publish","Requests","Amendments","Audit"].map(t=><Button key={t} data-guide-tab={t} variant={tab===t?"primary":"secondary"} disabled={busy} onClick={()=>setTab(t)}>{t}</Button>)}</nav>
    {tab==="Setup"&&<section className={panel}>
      <form key={`${newPeriod?"new":id}`} onSubmit={setup} className="space-y-3"><h2 className="font-semibold">{newPeriod||!period?"Create examination period":"Period setup"}</h2><p>Enter dates and times in institution-local scheduling time{period?.timezone?` (${period.timezone})`:""}.</p><fieldset disabled={busy||(!newPeriod&&!!period&&(!editable||period.exams.length>0))} className="grid gap-3 md:grid-cols-2">
      <label>Name <input className={field} name="name" required maxLength={120} defaultValue={newPeriod?"":String(period?.name??"")}/></label>
      <div><p className="text-sm font-medium">Academic year: {!newPeriod&&period?String(period.academic_year??"—"):"Set automatically from the latest student registrations"}</p><p className="text-sm text-muted">{!newPeriod&&period?"This saved year is retained when the period is edited.":"The server chooses the latest registered year when you save, regardless of semester or exam dates. Registrations must be loaded before scheduling."}</p></div>
      <label>Semester <select className={field} name="semester" defaultValue={String(period?.semester??1)}><option>1</option><option>2</option></select></label>
      <label>Exam type <select className={field} name="examType" defaultValue={String(period?.exam_type??"FINAL")}>{["FINAL","SUPPLEMENTARY","SPECIAL"].map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Start date <input className={field} type="date" name="startDate" required defaultValue={newPeriod?"":String(period?.start_date??"")}/></label>
      <label>End date <input className={field} type="date" name="endDate" required defaultValue={newPeriod?"":String(period?.end_date??"")}/></label>
      <div className="flex flex-wrap gap-3">{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d,i)=><label key={d}><input type="checkbox" name="day" value={i+1} defaultChecked={!newPeriod&&period?period.slots.some(s=>Number(s.day_of_week)===i+1):i<5}/> {d}</label>)}</div>
      <label>Daily slots (one HH:MM-HH:MM interval per line)<textarea className={`${field} block w-full`} name="slots" required defaultValue={!newPeriod&&period?[...new Set(period.slots.map(s=>`${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`))].join("\n"):"09:00-11:00\n11:00-13:00"}/></label>
      <Button type="submit">Save period</Button></fieldset></form>
      {editable&&!!period?.exams.length&&<p>Reset the draft from Timetable before changing dates, slots or course durations.</p>}
    </section>}
    {tab==="Courses"&&<section className={panel}><p>Registered students / required seats are calculated from all registrations matching each course, this period’s saved academic year and semester, for every exam type. Refresh the catalogue after registration changes; counts are read-only.</p><Button disabled={!period||busy} onClick={()=>run("courses")}>Load active courses and registration counts</Button>
      {!catalog.length&&<p>No courses loaded. Select a period and load its catalogue.</p>}
      <fieldset disabled={!editable||busy||!!period?.exams.length} className="space-y-2">{catalog.map(c=>{const code=String(c.course_code);return <div key={code} className="flex flex-wrap items-center gap-3"><label><input type="checkbox" checked={code in selection} onChange={e=>setSelection(s=>{const next={...s};if(e.target.checked)next[code]=120;else delete next[code];return next;})}/> {code} — {String(c.course_name)} (Registered students / required seats: {String(c.eligible_students)})</label>{code in selection&&<label>Minutes <input aria-label={`${code} duration`} className={field} type="number" min={1} max={1440} value={selection[code]} onChange={e=>setSelection(s=>({...s,[code]:Number(e.target.value)}))}/></label>}</div>;})}
      <Button disabled={!Object.keys(selection).length} onClick={()=>run("select",{revision:period?.revision,courses:Object.entries(selection).map(([courseCode,durationMinutes])=>({courseCode,durationMinutes}))})}>Save selected courses</Button></fieldset>
      <Table rows={period?.courses??[]} columns={["course_code","duration_minutes","eligible_students"]}/>
    </section>}
    {tab==="Venues"&&<section className={panel}><p>A venue’s verified examination capacity is its physical seating limit, separate from registered students / required seats. Never replace venue capacity with a course’s student count. Classroom capacity and verified examination capacity are separate. Unconfigured venues are excluded from generation. Obtain verification before saving. Use the capacity request draft below to contact an assigned lecturer.</p>
      {period&&<div className="space-y-3"><label>Selected course <select className={field} value={capacityCourse} onChange={e=>{setCapacityCourse(e.target.value);setLecturers([]);setDraft(null);}}><option value="">Select course</option>{period.courses.map(c=><option key={String(c.course_code)}>{String(c.course_code)}</option>)}</select></label> <Button disabled={busy||!capacityCourse} onClick={()=>run("lecturers",capacityCourse)}>Request examination capacity</Button>
      {!lecturers.length&&<p>No lecturer loaded. Select a course and request its assigned lecturers; missing assignments must be corrected before creating an addressed draft.</p>}
      {!!lecturers.length&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("capacityDraft",{periodId:id,courseCode:capacityCourse,venueId:Number(f.get("venue")),lecturerStaffId:Number(f.get("lecturer"))});}}><label>Assigned lecturer <select className={field} name="lecturer" required defaultValue=""><option value="">Choose lecturer explicitly</option>{lecturers.map(l=><option key={String(l.staff_id)} value={Number(l.staff_id)}>{String(l.full_name)} — {String(l.email)}</option>)}</select></label> <label>Venue <select className={field} name="venue" required>{venues.map(v=><option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</select></label> <Button disabled={busy}>Prepare email draft</Button></form>}
      {draft&&<div><p>Draft only — no email has been sent. Capacity is unchanged.</p><label>To <input className={field} readOnly value={draft.to}/></label><label>Subject <input className={`${field} w-full`} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label><label>Message <textarea className={`${field} w-full`} rows={7} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label><Button variant="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);setMessage("Draft copied. No delivery has occurred.");}catch{setMessage("Clipboard unavailable. Select and copy the draft text manually.");}}}>Copy draft</Button></div>}</div>}
      <Table rows={venues} columns={["venue_id","venue_name","capacity","examination_capacity"]}/>
      <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("capacity",{examinationCapacity:Number(f.get("capacity"))},0,Number(f.get("venue")));}}><label>Venue <select className={field} name="venue" required>{venues.map(v=><option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</select></label><label>Verified exam seats <input className={field} type="number" min={1} name="capacity" required/></label><Button disabled={busy}>Save verified capacity</Button></form>
      <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("unavailable",{startsAt:f.get("startsAt"),endsAt:f.get("endsAt"),reason:f.get("reason")},0,Number(f.get("venue")));}}><label>Venue <select className={field} name="venue" required>{venues.map(v=><option key={String(v.venue_id)} value={Number(v.venue_id)}>{String(v.venue_name)}</option>)}</select></label><label>Unavailable from <input className={field} type="datetime-local" name="startsAt" required/></label><label>Until <input className={field} type="datetime-local" name="endsAt" required/></label><label>Reason <input className={field} name="reason" maxLength={500} required/></label><Button disabled={busy}>Record unavailability</Button></form>
      <Button variant="secondary" disabled={busy} onClick={()=>run("unavailability")}>Show unavailable intervals</Button><Table rows={unavailable} columns={["venue_id","starts_at","ends_at","reason"]}/>
    </section>}
    {tab==="Timetable"&&<section className={panel}><p>Generation allocates all matching registered students and may split a course across rooms. Zero-student courses and insufficient venue seating prevent a complete timetable. After registration changes, reload counts and review the draft reset / regeneration workflow if allocations no longer match. Publication checks registrations again.</p>
      <label>Search limit <input className={field} type="number" min={1} max={1000000} value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label> <Button disabled={busy||!editable||limit<1||limit>1000000||!!period?.exams.length} onClick={()=>run("generate",{revision:period?.revision,searchLimit:limit})}>Generate draft</Button>
      {outcome&&<p role="status">Generation outcome: {outcome}</p>}
      {generationDetails!=null&&<details><summary>Generation diagnostics</summary><pre className="overflow-auto whitespace-pre-wrap text-sm">{JSON.stringify(generationDetails,null,2)}</pre></details>}
      {outcome==="SEARCH_LIMIT_REACHED"&&<div><p>A valid timetable may still exist. Increase the search limit or change dates, slots or venue availability.</p><Button disabled={busy||!editable||limit>=1000000||!!period?.exams.length} onClick={()=>{const next=Math.min(1000000,limit*2);setLimit(next);void run("generate",{revision:period?.revision,searchLimit:next});}}>Try again with a higher search limit</Button></div>}
      {outcome==="NO_FEASIBLE_ARRANGEMENT"&&<p>The configured automatic placements are exhausted. Add capacity or scheduling options. More slots alone cannot fix a per-exam seating shortage.</p>}
      {!!period?.conflictingExams?.length&&<div><h3>Existing examinations for selected courses and cycle</h3><Table rows={period.conflictingExams} columns={["exam_session_id","course_code","schedule_published","status","attendance_records","incident_records","report_records","staffing_records","allocation_records","booking_records"]}/><p>View the existing exam, keep it and deselect its course in Courses, or correct the cycle selection. Explicit replacement is not available.</p>{period.conflictingExams.map(e=><div key={String(e.exam_session_id)}><a className="underline" href={`/examinations?examSessionId=${e.exam_session_id}`}>View {String(e.course_code)}</a></div>)}</div>}
      <Table rows={period?.exams??[]} columns={["exam_session_id","course_code","exam_date","start_time","end_time","registered_students","allocated_students"]}/>
      <Table rows={period?.bookings??[]} columns={["exam_session_id","venue_id","venue_name","examination_capacity","allocated_students"]}/>
      <h3 className="font-medium">Student allocations</h3><Table rows={period?.allocations??[]} columns={["exam_session_id","computer_number","full_name","venue_id"]}/>
      <h3 className="font-medium">Unallocated students</h3><Table rows={period?.unallocatedStudents??[]} columns={["course_code","computer_number"]}/>
      {editable&&!!period?.exams.length&&<><Button variant="danger" disabled={busy} onClick={()=>setResetReview(true)}>Review reset / regeneration</Button>{resetReview&&<div><p>This will clear {period.exams.length} draft examinations, {period.bookings.length} venue bookings and {period.allocations.length} student allocations. Course selections and period settings are retained. You must explicitly generate a new draft afterwards. Cancel staffing first. Operational history blocks replacement.</p><Button disabled={busy} variant="danger" onClick={()=>{setResetReview(false);void run("reset",{revision:period.revision});}}>Confirm reset draft</Button> <Button variant="secondary" onClick={()=>setResetReview(false)}>Keep draft</Button></div>}</>}
      <label>Examination <select className={field} value={exam||""} onChange={e=>chooseExam(Number(e.target.value))}><option value="">Select exam</option>{period?.exams.map(e=><option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)}</option>)}</select></label>
      {exam>0&&<><Button variant="secondary" disabled={busy||!editable} onClick={()=>run("alternatives")}>Find valid alternatives</Button>{alternatives.map((p,i)=><Button variant="secondary" disabled={!editable} key={i} onClick={()=>{setMoveDate(p.start.slice(0,10));setMoveTime(p.start.slice(11,16));setMoveVenues(p.venues);}}>{p.start.replace("T"," ")} · venues {p.venues.join(", ")}</Button>)}
      <form onSubmit={e=>{e.preventDefault();void run("move",{revision:period?.revision,examDate:moveDate,startTime:moveTime,venueIds:moveVenues});}}><fieldset disabled={!editable||busy} className="space-y-3"><p>Cancel this exam’s staffing before moving it, then assign available invigilators again. Other exams remain in place.</p><label>Date <input className={field} type="date" required value={moveDate} onChange={e=>setMoveDate(e.target.value)}/></label> <label>Start <input className={field} type="time" required value={moveTime} onChange={e=>setMoveTime(e.target.value)}/></label><div>{venues.map(v=><label className="mr-3" key={String(v.venue_id)}><input type="checkbox" checked={moveVenues.includes(Number(v.venue_id))} onChange={e=>setMoveVenues(s=>e.target.checked?[...s,Number(v.venue_id)]:s.filter(n=>n!==Number(v.venue_id)))}/> {String(v.venue_name)}</label>)}</div><Button disabled={!moveVenues.length}>Save placement</Button></fieldset></form></>}
    </section>}
    {tab==="Staffing"&&<section className={panel}>
      <Button disabled={busy||!editable||!period?.exams.length} onClick={()=>run("autoAssign")}>Automatically assign available invigilators</Button>
      <label>Examination <select className={field} value={exam||""} onChange={e=>chooseExam(Number(e.target.value))}><option value="">Select exam</option>{period?.exams.map(e=><option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)}</option>)}</select></label> <Button variant="secondary" disabled={busy||!exam} onClick={()=>run("staffing")}>Review venue staffing</Button>
      {!staffing.length&&<p>Select an examination and review staffing for required, assigned and missing counts.</p>}
      {staffing.map(s=><div key={s.venueId}><p>Venue #{s.venueId}: required {s.requiredInvigilatorCount}, assigned {s.assignedInvigilatorCount}, missing {Math.max(0,s.requiredInvigilatorCount-s.assignedInvigilatorCount)}</p><form onSubmit={e=>{e.preventDefault();void run("assign",{examSessionId:exam,venueId:s.venueId,staffId:Number(new FormData(e.currentTarget).get("staff"))});}}><select aria-label={`Available invigilator for venue ${s.venueId}`} className={field} name="staff" required>{s.remainingInvigilators.map(a=><option key={a.staffId} value={a.staffId}>{a.fullName}</option>)}</select> <Button disabled={!editable||busy||!s.remainingInvigilators.length}>Assign invigilator</Button></form></div>)}
      <Table rows={period?.assignments??[]} columns={["exam_session_id","venue_id","staff_id","assignment_status"]}/>
      {editable&&period?.assignments.map(a=><Button variant="secondary" disabled={busy} key={`${a.exam_session_id}/${a.venue_id}/${a.staff_id}`} onClick={()=>run("cancel",undefined,Number(a.exam_session_id),Number(a.venue_id),Number(a.staff_id))}>Cancel duty: exam {String(a.exam_session_id)}, venue {String(a.venue_id)}, staff {String(a.staff_id)}</Button>)}
    </section>}
    {tab==="Publish"&&<section className={panel}><p>Publication requires complete allocations and available active invigilators in every venue. Published examinations are locked. Use the separate proposal, decision and apply steps in Amendments for published timetable changes.</p><Button variant="secondary" disabled={busy||!period} onClick={()=>run("validate")}>Validate publication</Button> <Button disabled={busy||!editable||!validated} onClick={()=>run("publish",{revision:period?.revision})}>Publish timetable and staffing</Button><p>Publish performs fresh checks under the transaction lock.</p></section>}
    {blockers.length>0&&<div className={panel} role="alert"><ul className="list-disc pl-5">{blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
    {tab==="Requests"&&<section className={panel}><p>Requests record proposed corrections. Approval records the Administrator’s decision and does not change the timetable. Propose, approve and apply published timetable changes separately in Amendments.</p><Button disabled={busy||!period} onClick={()=>run("requests")}>Load change requests</Button>
      <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("request",{periodId:id,courseCode:f.get("course"),examSessionId:f.get("exam")?Number(f.get("exam")):null,proposedChange:f.get("proposal"),reason:f.get("reason")});}}><fieldset disabled={busy||!period} className="space-y-3"><label>Course <select className={field} name="course" required>{period?.courses.map(c=><option key={String(c.course_code)}>{String(c.course_code)}</option>)}</select></label> <label>Exam (optional) <select className={field} name="exam"><option value="">Course-wide</option>{period?.exams.map(e=><option key={String(e.exam_session_id)} value={Number(e.exam_session_id)}>{String(e.course_code)} #{String(e.exam_session_id)}</option>)}</select></label><label className="block">Proposed change <textarea className={`${field} w-full`} name="proposal" required maxLength={4000}/></label><label className="block">Reason <textarea className={`${field} w-full`} name="reason" required maxLength={2000}/></label><Button>Submit change request</Button></fieldset></form>
      <Table rows={requests} columns={["request_id","requester_staff_id","course_code","exam_session_id","proposed_change","reason","status","decision"]}/>
      {period&&requests.filter(q=>q.status==="PENDING").map(q=><form key={String(q.request_id)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("decision",{status:f.get("status"),decision:f.get("decision")},Number(q.request_id));}}><p>Review request #{String(q.request_id)}</p><select className={field} name="status"><option>APPROVED</option><option>REJECTED</option></select> <label>Decision reason <input className={field} name="decision" required maxLength={2000}/></label> <Button disabled={busy}>Record decision</Button></form>)}
    </section>}
    {tab==="Amendments"&&<section className={panel}><p>An Administrator may propose and approve their own amendment. Approval leaves the timetable unchanged; Apply performs fresh checks of slots, capacity, bookings, allocations, eligibility and staffing. Only future, scheduled, published exams without attendance, incidents or generated reports are eligible. Omit venue or duty changes to retain the current set.</p>
      <Button disabled={busy||!period} onClick={()=>run("amendments")}>Load amendments / check status</Button>
      <AmendmentForm key={id} revision={period?.revision??0} exams={period?.exams??[]} venues={venues} disabled={busy||period?.status!=="PUBLISHED"} onSubmit={proposal=>void run("proposeAmendment",proposal)}/>
      <Table rows={amendments} columns={["amendment_id","exam_session_id","expected_revision","exam_date","start_time","end_time","reason","status","reviewed_by_staff_id","decision","applied_at"]}/>
      {amendments.map(a=><div key={String(a.amendment_id)} className="space-y-3 border-t pt-3"><p>Amendment #{String(a.amendment_id)}</p>
        <p>Proposed venues: {Array.isArray(a.venueIds)?a.venueIds.join(", "):"Retained"}</p>
        <h3 className="font-medium">Proposed duties</h3><Table rows={Array.isArray(a.duties)?a.duties as Row[]:[]} columns={["venue_id","staff_id"]}/>
        <details><summary>Review proposed student allocations</summary><Table rows={Array.isArray(a.allocations)?a.allocations as Row[]:[]} columns={["computer_number","venue_id"]}/></details>
        {a.status==="APPLIED"&&<div className="grid gap-4 lg:grid-cols-2"><Arrangement title="Before amendment" value={a.before_arrangement}/><Arrangement title="After amendment" value={a.after_arrangement}/></div>}
        {period&&a.status==="PENDING"&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run("decideAmendment",{status:f.get("status"),reason:f.get("reason")},Number(a.amendment_id));}}><select className={field} name="status"><option>APPROVED</option><option>REJECTED</option></select> <label>Review reason <input className={field} name="reason" required maxLength={2000}/></label> <Button disabled={busy}>Record amendment decision</Button></form>}{period&&a.status==="APPROVED"&&<Button disabled={busy} onClick={()=>run("applyAmendment",{},Number(a.amendment_id))}>Apply approved amendment after fresh validation</Button>}{a.status==="APPLIED"&&<><Button variant="secondary" disabled={busy} onClick={()=>run("notifications",undefined,Number(a.amendment_id))}>Check notification delivery</Button> <Button variant="secondary" disabled={busy||!period} onClick={()=>run("retryNotifications",{},Number(a.amendment_id))}>Retry inbox delivery only</Button></>}</div>)}
      <p>Notifications are delivered to the application inbox after successful commit. No emails are sent. Failed or pending deliveries can be retried without changing the timetable again.</p>
      <Table rows={notifications} columns={["recipient_kind","recipient_id","delivery_status","attempts","available_at","read_at","last_error"]}/>
    </section>}
    {tab==="Audit"&&<section className={panel}><Button disabled={busy} onClick={()=>run("audit")}>Investigate historical allocations</Button><p>Verify actual registration and booking before correction. Do not delete ambiguous history or change registrations to force a count.</p><Table rows={audit} columns={["computer_number","exam_session_id","venue_id","course_code","issue"]}/><Button disabled={busy||!period} onClick={()=>run("history")}>Load period change history</Button><Table rows={history.map(h=>({...h,before_record:JSON.stringify(h.before_record),after_record:JSON.stringify(h.after_record)}))} columns={["occurred_at","actor_staff_id","action","entity","before_record","after_record"]}/></section>}
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
