import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "请输入账号和密码" },
        { status: 400 }
      );
    }

    const client = getClient();

    // Find user by email
    const { data: user, error } = await client
      .from("users")
      .select("id, name, email, role, password, status")
      .eq("email", email)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: "账号或密码错误" },
        { status: 401 }
      );
    }

    // Check if user is disabled
    if (user.status === "inactive") {
      return NextResponse.json(
        { success: false, error: "账号已被停用，请联系管理员" },
        { status: 403 }
      );
    }

    // Check if password exists
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: "账号未设置密码，请联系管理员" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "账号或密码错误" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = await signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // Set cookie - httpOnly for security, 7 days expiry
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === "PROD",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}
