import { getSessionAdmin } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/responses";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return apiError("unauthorized", "Login required.", 401);
  return apiOk({ admin });
}
