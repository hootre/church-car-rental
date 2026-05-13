import { NextRequest, NextResponse } from "next/server";

// ===== 설정 =====
const SECURITY_CONFIG = {
  // 해외 접근 차단 (true = 한국만 허용)
  GEO_BLOCK_ENABLED: true,
  ALLOWED_COUNTRIES: ["KR"],

  // 봇 트래픽 차단
  BOT_BLOCK_ENABLED: true,

  // API 레이트 리밋 (분당 요청 수)
  API_RATE_LIMIT: 60,
  API_RATE_WINDOW_MS: 60_000,

  // 정적 파일은 검사 스킵
  SKIP_PATHS: [
    "/_next/",
    "/favicon.ico",
    "/og-image.png",
    "/icons/",
    "/manifest.json",
  ],
};

// 악성 봇 User-Agent 패턴 (대소문자 무시)
const BLOCKED_BOT_PATTERNS = [
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /httpclient/i,
  /java\//i,
  /libwww-perl/i,
  /php\//i,
  /go-http-client/i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /semrush/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /bytespider/i,
  /gptbot/i,
  /claudebot/i,
  /ccbot/i,
];

// 허용할 봇 (검색엔진 크롤러)
const ALLOWED_BOTS = [
  /googlebot/i,
  /bingbot/i,
  /yeti/i, // 네이버
  /daumoa/i, // 다음
  /kakaotalk-scrap/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /slackbot/i,
  /linkedinbot/i,
  /line-poker/i,
];

// WAF: 의심스러운 경로 패턴
const SUSPICIOUS_PATHS = [
  /\.env/i,
  /\.git/i,
  /\.svn/i,
  /\.htaccess/i,
  /wp-admin/i,
  /wp-login/i,
  /wp-content/i,
  /wp-includes/i,
  /phpmyadmin/i,
  /adminer/i,
  /xmlrpc\.php/i,
  /cgi-bin/i,
  /\.asp$/i,
  /\.jsp$/i,
  /\.php$/i,
  /shell/i,
  /eval\(/i,
  /base64/i,
  /etc\/passwd/i,
  /proc\/self/i,
  /\.\.\/\.\.\//,
];

// WAF: SQL Injection 패턴 (쿼리스트링/바디에 대해)
const SQL_INJECTION_PATTERNS = [
  /(\bunion\b.*\bselect\b)/i,
  /(\bselect\b.*\bfrom\b.*\bwhere\b)/i,
  /(\bdrop\b.*\btable\b)/i,
  /(\binsert\b.*\binto\b)/i,
  /(\bdelete\b.*\bfrom\b)/i,
  /(\bupdate\b.*\bset\b)/i,
  /(--|#|\/\*)/,
  /(\bor\b\s+\d+\s*=\s*\d+)/i,
  /(\band\b\s+\d+\s*=\s*\d+)/i,
  /'\s*(or|and)\s+'?\d/i,
];

// WAF: XSS 패턴
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover|focus|blur)\s*=/i,
  /eval\s*\(/i,
  /document\.(cookie|location|write)/i,
  /window\.(location|open)/i,
];

// ===== 레이트 리밋 (인메모리) =====
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // 메모리 관리
  if (rateLimitMap.size > 50000) {
    for (const [key, val] of rateLimitMap) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + SECURITY_CONFIG.API_RATE_WINDOW_MS,
    });
    return true;
  }

  record.count++;
  return record.count <= SECURITY_CONFIG.API_RATE_LIMIT;
}

// ===== Middleware 본체 =====
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일 스킵
  if (SECURITY_CONFIG.SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  const url = request.url;

  // ===== 1. WAF: 의심스러운 경로 차단 =====
  if (SUSPICIOUS_PATHS.some((p) => p.test(pathname))) {
    console.log(`[WAF] 의심 경로 차단: ${ip} → ${pathname}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ===== 2. WAF: SQL Injection / XSS 검사 (쿼리스트링) =====
  const queryString = request.nextUrl.search || "";
  if (queryString) {
    const decoded = decodeURIComponent(queryString);
    if (SQL_INJECTION_PATTERNS.some((p) => p.test(decoded))) {
      console.log(`[WAF] SQL Injection 차단: ${ip} → ${url}`);
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (XSS_PATTERNS.some((p) => p.test(decoded))) {
      console.log(`[WAF] XSS 차단: ${ip} → ${url}`);
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ===== 3. 해외 접근 차단 =====
  if (SECURITY_CONFIG.GEO_BLOCK_ENABLED) {
    // Vercel은 x-vercel-ip-country 헤더를 자동으로 제공
    const country = request.headers.get("x-vercel-ip-country") || "";

    // 헤더 없으면 (로컬 개발 등) 통과, 있으면 한국만 허용
    if (country && !SECURITY_CONFIG.ALLOWED_COUNTRIES.includes(country)) {
      // 허용된 봇(검색엔진)은 해외에서도 접근 허용
      if (!ALLOWED_BOTS.some((p) => p.test(userAgent))) {
        console.log(`[GEO] 해외 접근 차단: ${ip} (${country}) → ${pathname}`);
        return new NextResponse(
          JSON.stringify({
            error: "이 서비스는 국내에서만 이용 가능합니다.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
  }

  // ===== 4. 봇 트래픽 차단 =====
  if (SECURITY_CONFIG.BOT_BLOCK_ENABLED && userAgent) {
    // 허용 봇이면 통과
    const isAllowedBot = ALLOWED_BOTS.some((p) => p.test(userAgent));

    if (!isAllowedBot) {
      // 악성 봇 패턴 체크
      if (BLOCKED_BOT_PATTERNS.some((p) => p.test(userAgent))) {
        console.log(`[BOT] 봇 차단: ${ip} → ${userAgent.slice(0, 80)}`);
        return new NextResponse("Forbidden", { status: 403 });
      }

      // User-Agent 없는 요청 차단 (API 경로만)
      if (!userAgent.trim() && pathname.startsWith("/api/")) {
        console.log(`[BOT] UA 없는 API 요청 차단: ${ip}`);
        return new NextResponse("Forbidden", { status: 403 });
      }
    }
  }

  // ===== 5. API 레이트 리밋 =====
  if (pathname.startsWith("/api/")) {
    if (!checkApiRateLimit(ip)) {
      console.log(`[RATE] API 레이트 리밋 초과: ${ip}`);
      return new NextResponse(
        JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }
  }

  // 통과
  const response = NextResponse.next();

  // 추가 보안 헤더 (next.config.js 보완)
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

// 미들웨어 적용 경로
export const config = {
  matcher: [
    // 정적 파일 제외, 나머지 모두 적용
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
  ],
};
