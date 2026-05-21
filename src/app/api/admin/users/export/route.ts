import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get locale from search params
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") ?? "en";

    // Verify admin permission
    const admin = await requireAdmin(locale, `/${locale}/admin/users`);

    // Get filter params
    const query = searchParams.get("query") || undefined;
    const roleFilter = searchParams.get("role") || undefined;
    const statusFilter = searchParams.get("status") || undefined;
    const typeFilter = searchParams.get("type") || undefined;
    const sortColumn = searchParams.get("sort") || "created_at";
    const sortDirection = searchParams.get("order") || "desc";

    // Call RPC to get all filtered users (large page size for export)
    const supabase = createSupabaseAdminClient();
    const { data: paginatedData, error } = await (supabase.rpc as any)("get_admin_users_paginated", {
      input_page: 1,
      input_per_page: 10000, // Large limit for export
      input_search: query ?? null,
      input_role_filter: roleFilter ?? null,
      input_status_filter: statusFilter ?? null,
      input_type_filter: typeFilter ?? null,
      input_sort_column: sortColumn,
      input_sort_direction: sortDirection,
    });

    if (error) {
      console.error("Export error:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const paginatedResult = (paginatedData as any)?.[0];
    if (!paginatedResult) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const users = (paginatedResult.users as any) as Array<{
      id: string;
      email: string;
      display_name: string | null;
      admin_role: string | null;
      account_status: string | null;
      is_admin: boolean | null;
      created_at: string;
    }>;

    // Convert to CSV
    const headers = ["ID", "Email", "Display Name", "Role", "Status", "Type", "Created At"];
    const rows = users.map((user) => [
      user.id,
      user.email,
      user.display_name || "",
      user.admin_role || (user.is_admin ? "owner" : "user"),
      user.account_status || "active",
      user.is_admin ? "Admin" : "Standard",
      new Date(user.created_at).toISOString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
