import { redirect } from "next/navigation";

export default function Home() {
  // Command-first landing (Navigation Architecture §6). The legacy /dashboard
  // route still resolves for existing deep links.
  redirect("/command");
}
