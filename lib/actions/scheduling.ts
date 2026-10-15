"use server";
import { apiRequest, ApiError } from "@/lib/api/client";

type Operation = "defaults" | "amendments" | "proposeAmendment" | "decideAmendment" | "applyAmendment" | "notifications" | "retryNotifications" | "requests" | "request" | "decision" | "lecturers" | "capacityDraft" | "list" | "detail" | "create" | "setup" | "courses" | "generate" | "move" | "alternatives" | "staffing" | "assign" | "autoAssign" | "cancel" | "validate" | "publish" | "venues" | "capacity" | "unavailability" | "unavailable" | "audit" | "history";
export async function schedulingAction(operation: Operation, id = 0, body?: unknown, exam = 0, venue = 0, staff = 0) {
  const base = "/api/admin/examination-periods";
  const routes: Record<Operation, [string, string]> = {
    amendments:[`${base}/${id}/amendments`,"GET"], proposeAmendment:[`${base}/${id}/amendments`,"POST"],
    decideAmendment:[`${base}/${id}/amendments/${exam}/decision`,"POST"], applyAmendment:[`${base}/${id}/amendments/${exam}/apply`,"POST"],
    notifications:[`${base}/${id}/amendments/${exam}/notifications`,"GET"], retryNotifications:[`${base}/${id}/amendments/${exam}/retry-notifications`,"POST"],
    requests:[`/api/examination-change-requests?periodId=${id}`,"GET"], request:["/api/examination-change-requests","POST"],
    decision:[`/api/examination-change-requests/${exam}/decision`,"POST"], lecturers:[`/api/examination-change-requests/capacity-lecturers?periodId=${id}&courseCode=${encodeURIComponent(String(body??""))}`,"GET"],
    capacityDraft:["/api/examination-change-requests/capacity-draft","POST"],
    defaults: [`${base}/defaults`,"GET"],
    list: [base,"GET"], detail: [`${base}/${id}`,"GET"], create:[base,"POST"], setup:[`${base}/${id}?revision=${exam}`,"PUT"],
    courses:[`${base}/${id}/courses`,"GET"], generate:[`${base}/${id}/generate`,"POST"],
    move:[`${base}/${id}/exams/${exam}/placement`,"PUT"], alternatives:[`${base}/${id}/exams/${exam}/alternatives`,"GET"],
    staffing:[`/api/admin/invigilator-assignments/exam-sessions/${exam}/staffing`,"GET"], assign:[`${base}/${id}/invigilators`,"POST"],
    autoAssign:[`${base}/${id}/auto-assign-invigilators`,"POST"], cancel:[`/api/admin/invigilator-assignments/${exam}/${venue}/${staff}/cancel`,"POST"],
    validate:[`${base}/${id}/validation`,"GET"], publish:[`${base}/${id}/publish`,"POST"], venues:[`${base}/venues`,"GET"],
    capacity:[`${base}/venues/${venue}/capacity`,"PUT"], unavailability:[`${base}/venue-unavailability`,"GET"], unavailable:[`${base}/venues/${venue}/unavailability`,"POST"],
    audit:[`${base}/allocation-audit`,"GET"], history:[`${base}/${id}/history`,"GET"]
  };
  if (!Object.hasOwn(routes,operation)) return {ok:false, message:"Unsupported operation", status:400, data:null};
  const [path,method]=routes[operation];
  try { return {ok:true,message:"Saved / loaded successfully",status:200,data:await apiRequest<unknown>(path,{method,body:method==="GET"?undefined:body,noRetry:method!=="GET"})}; }
  catch(error) {
    if(error instanceof ApiError) {
      const envelope=error.payload as {data?:unknown}|undefined;
      return {ok:false,message:error.message,status:error.status,data:envelope?.data??null};
    }
    return {ok:false,message:"Connection failure. Check status and revision before explicitly retrying; the operation may have committed.",status:503,data:null};
  }
}
