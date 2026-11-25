"use client";

import dynamic from "next/dynamic";

const UserLogin = dynamic(() => import("@/components/UserLogin"), {
  ssr: false,
});
const UserRegistration = dynamic(
  () => import("@/components/UserRegistration"),
  { ssr: false },
);
const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
});
const SecurityDetail = dynamic(
  () => import("@/components/SecurityDetail"),
  { ssr: false },
);

export type ClientRouteName = "login" | "register" | "dashboard" | "security";

export function ClientRoute({ route }: { route: ClientRouteName }) {
  switch (route) {
    case "login":
      return <UserLogin />;
    case "register":
      return <UserRegistration />;
    case "dashboard":
      return <Dashboard />;
    case "security":
      return <SecurityDetail />;
  }
}
