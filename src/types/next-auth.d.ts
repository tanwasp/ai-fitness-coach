import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    userId: string;
    userName: string;
  }
  interface User {
    id: string;
    name: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    userName: string;
  }
}
