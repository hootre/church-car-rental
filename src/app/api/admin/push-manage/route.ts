import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** User-Agent 문자열에서 사람이 읽을 수 있는 기기명 추출 */
function parseDeviceName(ua: string, endpoint: string): string {
  if (!ua) {
    // UA 없으면 endpoint로 플랫폼만 구분
    if (endpoint.includes("fcm.googleapis.com")) return "Chrome 기기";
    if (endpoint.includes("mozilla.com")) return "Firefox 기기";
    return "알 수 없는 기기";
  }

  // 모바일 기기 감지
  const mobileMatch = ua.match(
    /\b(SM-[A-Z0-9]+|Galaxy [A-Za-z0-9 ]+|Pixel [0-9a-z]+|iPhone|iPad|LG-[A-Z0-9]+)/i
  );

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isWindows = /Windows/i.test(ua);

  let device = "";
  if (mobileMatch) {
    device = mobileMatch[1];
  } else if (isAndroid) {
    // Android에서 모델명 추출 시도
    const modelMatch = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    device = modelMatch ? modelMatch[1].trim() : "Android 기기";
  } else if (isIOS) {
    device = "iPhone";
  } else if (isMac) {
    device = "Mac";
  } else if (isWindows) {
    device = "Windows PC";
  } else {
    device = "기기";
  }

  // 브라우저 감지
  let browser = "Chrome";
  if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/SamsungBrowser/i.test(ua)) browser = "삼성브라우저";

  return `${device} (${browser})`;
}

// 전체 관리자의 푸시 구독 현황 조회 (최고관리자만)
export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse();

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, admin_id, endpoint, user_agent, created_at, last_used_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // admin_id별 구독 수 집계 (기존 호환)
  const statusMap: Record<string, number> = {};
  // 기기별 상세 목록
  const devices: {
    id: string;
    admin_id: string;
    device_name: string;
    endpoint_short: string;
    created_at: string;
    last_used_at: string | null;
  }[] = [];

  for (const sub of data || []) {
    statusMap[sub.admin_id] = (statusMap[sub.admin_id] || 0) + 1;
    devices.push({
      id: sub.id,
      admin_id: sub.admin_id,
      device_name: parseDeviceName(sub.user_agent || "", sub.endpoint || ""),
      endpoint_short: (sub.endpoint || "").slice(0, 60),
      created_at: sub.created_at,
      last_used_at: sub.last_used_at,
    });
  }

  return NextResponse.json({ statusMap, devices });
}

// 푸시 구독 삭제 (최고관리자만)
export async function DELETE(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorizedResponse();
  if (admin.role !== "super_admin") return forbiddenResponse();

  try {
    const body = await request.json();

    // 개별 기기 삭제 (subscription_id)
    if (body.subscription_id) {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("id", body.subscription_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // 관리자 전체 삭제 (admin_id) — 기존 호환
    if (body.admin_id) {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("admin_id", body.admin_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "subscription_id 또는 admin_id 필요" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
