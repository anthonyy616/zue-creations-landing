import { NextResponse } from "next/server";

export async function DELETE() {
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 }
  );
}
