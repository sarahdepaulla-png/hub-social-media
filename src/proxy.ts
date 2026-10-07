import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const isLogin = createRouteMatcher(["/entrar"]);

/**
 * Checagem otimista de sessão. A regra de acesso de verdade
 * (admin x cliente, qual workspace) fica no servidor do Convex.
 */
export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // O link de acesso funciona mesmo com outra sessão aberta no aparelho.
    // Link de acesso e conexão do Instagram funcionam sem login.
    if (request.nextUrl.pathname.startsWith("/acesso/") || request.nextUrl.pathname.startsWith("/instagram/")) return;
    const authed = await convexAuth.isAuthenticated();
    if (!isLogin(request) && !authed) {
      const url = new URL("/entrar", request.url);
      const back = request.nextUrl.pathname + request.nextUrl.search;
      if (back !== "/") url.searchParams.set("volta", back);
      return NextResponse.redirect(url);
    }
    if (isLogin(request) && authed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
