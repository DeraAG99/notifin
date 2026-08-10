"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { AdminForm } from "@/components/admins/admin-form";
import { EmptyState } from "@/components/shared/empty-state";
import { format } from "date-fns";
import { Plus, Search, Pencil, Trash2, ShieldCheck, Building2 } from "lucide-react";
import type { Admin, AdminSummary } from "@/types";

export default function AdminsPage() {
  const { t, tx } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminSummary | null>(null);

  const fetchAdmins = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admins?page=${page}&search=${search}`);
      const data = await res.json();
      if (data.success) {
        setAdmins(data.data.items);
        setPagination({
          page: data.data.page,
          totalPages: data.data.totalPages,
          total: data.data.total,
        });
      } else if (res.status === 403) {
        toast.add({ title: t.common.error, description: data.error, type: "error" });
        router.push("/dashboard");
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal memuat admin", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== "superadmin") {
      router.push("/dashboard");
      return;
    }
    fetchAdmins();
  }, [search, user]);

  const handleDelete = async () => {
    if (!selectedAdmin) return;
    try {
      const res = await fetch(`/api/admins/${selectedAdmin.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.deleted, description: `"${selectedAdmin.name}" berhasil dihapus`, type: "success" });
        fetchAdmins(pagination.page);
      } else {
        toast.add({ title: t.common.error, description: data.error || "Gagal menghapus", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal menghapus admin", type: "error" });
    }
    setDeleteOpen(false);
    setSelectedAdmin(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.admins.title}</h1>
          <p className="text-muted-foreground">{t.admins.description}</p>
        </div>
        <Button onClick={() => { setSelectedAdmin(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> {t.admins.newAdmin}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.admins.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {tx("admins.adminCount", { count: pagination.total })}
        </span>
      </div>

      {loading && admins.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">{t.common.loading}</div>
      ) : admins.length === 0 ? (
        <EmptyState
          title={t.admins.noAdmins}
          description={t.admins.noAdminsDesc}
          actionLabel={t.admins.addAdmin}
          actionHref="#"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.admins.title}</TableHead>
                <TableHead>{t.admins.email}</TableHead>
                <TableHead>{t.admins.role}</TableHead>
                <TableHead>{t.admins.users}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{t.admins.expires}</TableHead>
                <TableHead>{t.admins.created}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                        {admin.role === "superadmin" ? (
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="font-medium">{admin.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.role === "superadmin" ? "default" : "secondary"}>
                      {admin.role === "superadmin" ? t.admins.roleSuper : t.admins.roleAdmin}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{admin.userCount}</TableCell>
                  <TableCell>
                    <Badge variant={admin.isActive ? "default" : "secondary"}>
                      {admin.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {admin.expiresAt ? (
                      <Badge
                        variant={
                          new Date(admin.expiresAt).getTime() < Date.now()
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {new Date(admin.expiresAt).getTime() < Date.now()
                          ? t.admins.expired
                          : format(new Date(admin.expiresAt), "dd MMM yyyy")}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {admin.createdAt ? format(new Date(admin.createdAt), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {admin.role !== "superadmin" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setSelectedAdmin(admin); setFormOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setSelectedAdmin(admin); setDeleteOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAdmins(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            {t.common.previous}
          </Button>
          <span className="text-sm">
            {t.common.page} {pagination.page} {t.common.of} {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAdmins(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            {t.common.next}
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAdmin ? t.admins.editAdmin : t.admins.addAdmin}
            </DialogTitle>
            <DialogDescription>
              {selectedAdmin ? t.admins.editAdminDesc : t.admins.addAdminDesc}
            </DialogDescription>
          </DialogHeader>
          <AdminForm
            admin={selectedAdmin as Admin | null}
            onSuccess={() => {
              setFormOpen(false);
              fetchAdmins(pagination.page);
              toast.add({
                title: selectedAdmin ? t.admins.editAdmin : t.admins.newAdmin,
                description: selectedAdmin
                  ? "Admin berhasil diperbarui"
                  : "Admin baru berhasil ditambahkan",
                type: "success",
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.admins.deleteAdmin}</DialogTitle>
            <DialogDescription>
              {tx("admins.deleteConfirm", { name: selectedAdmin?.name || "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t.common.delete}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
