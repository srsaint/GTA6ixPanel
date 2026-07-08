import { clearSessionCookie } from "@/lib/auth";
import { apiOk } from "@/lib/responses";

export async function POST() {
  await clearSessionCookie();
  return apiOk({});
}
