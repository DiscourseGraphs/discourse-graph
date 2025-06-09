import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "~/utils/supabase/server";

const requestSchema = z
  .object({
    code: z.string().optional(),
    state: z.string().optional(),
  })
  .refine((data) => data.code || data.state, {
    message: "Either code or state must be provided",
  });

export const POST = async (request: Request) => {
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // const supabase = await createClient();

    // let query = supabase
    //   .from("access-token")
    //   .select("access-token, code, state, created_date")
    //   .order("created_date", { ascending: false })
    //   .limit(1);

    // if (validatedData.code) {
    //   query = query.eq("code", validatedData.code);
    // } else if (validatedData.state) {
    //   query = query.eq("state", validatedData.state);
    // }

    // const { data, error } = await query;

    const data = { "access-token": "dummy data" };
    const error = null;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch access token" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No access token found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ accessToken: data["access-token"] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
};
