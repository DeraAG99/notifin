import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Registrasi ditutup. Akun hanya dapat dibuat oleh Super Admin.",
    },
    { status: 403 }
  );
}
