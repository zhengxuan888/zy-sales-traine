import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getClient } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getUserFromRequest(request);
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["active", "inactive"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "无效的状态值" },
        { status: 400 }
      );
    }

    const client = getClient();

    // Update user status
    const { data: updatedUser, error } = await client
      .from("users")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, email, role, status")
      .single();

    if (error) throw error;

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: status === "inactive" ? "员工已停用" : "员工已启用",
    });
  } catch (error) {
    console.error("Failed to update user status:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "更新失败" },
      { status: 500 }
    );
  }
}
