/**
 * 관리자 활동 로그 유틸리티
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface LogEntry {
  admin_id: string;
  admin_name: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
}

export async function writeAdminLog(entry: LogEntry) {
  try {
    const { error } = await supabase.from("admin_logs").insert({
      admin_id: entry.admin_id,
      admin_name: entry.admin_name,
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: entry.target_id || null,
      details: entry.details || {},
    });

    if (error) {
      console.warn("[AdminLog] 로그 기록 실패:", error.message);
    }
  } catch (e) {
    console.warn("[AdminLog] 에러:", e);
  }
}
