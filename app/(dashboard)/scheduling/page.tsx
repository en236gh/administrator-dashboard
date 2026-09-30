import { AppShell } from "@/components/layout/app-shell";
import { SchedulingWorkspace } from "@/components/admin/scheduling-workspace";
import { getSessionUser } from "@/lib/auth/session";
export default async function SchedulingPage() {
  const user=await getSessionUser(); if(!user) return null;
  return <AppShell title="Exam Management" user={user}><SchedulingWorkspace administratorEmail={user.email} /></AppShell>;
}
