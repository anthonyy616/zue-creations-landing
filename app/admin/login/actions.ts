"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";
import { warn, error, info } from "@/lib/log";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const emailRaw = formData.get("email")?.toString() ?? "";
  const passwordRaw = formData.get("password")?.toString() ?? "";

  const parsed = loginSchema.safeParse({
    email: emailRaw,
    password: passwordRaw,
  });

  if (!parsed.success) {
    warn("Login failed: invalid form input", undefined, {
      operation: "login",
      context: { reason: parsed.error.issues[0]?.message ?? "schema parse failed" },
    });
    return { error: "Please check your email and password." };
  }

  const { email, password } = parsed.data;

  try {
    const user = await verifyCredentials(email, password);
    if (!user) {
      warn("Login failed: credentials rejected", undefined, {
        operation: "login",
        context: { email },
      });
      return { error: "Please check your email and password." };
    }

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isLoggedIn = true;
    await session.save();

    info("Login succeeded", { operation: "login", context: { userId: user.id, email } });
    redirect("/admin/dashboard");
  } catch (err) {
    error("Login action threw an unexpected error", err, {
      operation: "login",
      context: { email },
    });
    return { error: "Something went wrong. Please try again." };
  }
}
