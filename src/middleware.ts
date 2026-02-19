export { default } from "next-auth/middleware";

export const config = {
  // Protect every route except NextAuth API, login page, and Next.js internals
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
