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
import { Plus, Search, Pencil, Trash2, Upload, MessageSquare, Mail, UserIcon, ClipboardList } from "lucide-react";
import { UserForm } from "@/components/users/user-form";
import { CsvImport } from "@/components/users/csv-import";
import { EmptyState } from "@/components/shared/empty-state";
import type { User, PaginatedResponse } from "@/types";

export default function UsersPage() {
  const { t, tx } = useI18n();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?page=${page}&search=${search}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.items);
        setPagination({
          page: data.data.page,
          totalPages: data.data.totalPages,
          total: data.data.total,
        });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal memuat pengguna", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.deleted, description: `"${selectedUser.name}" berhasil dihapus`, type: "success" });
        fetchUsers(pagination.page);
      } else {
        toast.add({ title: t.common.error, description: data.error || "Gagal menghapus", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal menghapus pengguna", type: "error" });
    }
    setDeleteOpen(false);
    setSelectedUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.users.title}</h1>
          <p className="text-muted-foreground">{t.users.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> {t.users.importCSV}
          </Button>
          <Button onClick={() => { setSelectedUser(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> {t.users.newUser}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.users.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {tx("users.userCount", { count: pagination.total })}
        </span>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title={t.users.noUsers}
          description={t.users.noUsersDesc}
          actionLabel={t.users.addUser}
          actionHref="#"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.users.title}</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {user.phone && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          {user.phone}
                        </div>
                      )}
                      {user.email && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {user.email}
                        </div>
                      )}
                      {!user.phone && !user.email && (
                        <span className="text-sm text-muted-foreground">{t.users.noContactInfo}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.timezone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/users/${user.id}/imports`)}
                        title={t.imports.button}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setSelectedUser(user); setFormOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setSelectedUser(user); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
            onClick={() => fetchUsers(pagination.page - 1)}
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
            onClick={() => fetchUsers(pagination.page + 1)}
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
              {selectedUser ? t.users.editUser : t.users.addUser}
            </DialogTitle>
          </DialogHeader>
          <UserForm
            user={selectedUser}
            onSuccess={() => {
              setFormOpen(false);
              fetchUsers(pagination.page);
              toast.add({
                title: selectedUser ? t.users.editUser : t.users.newUser,
                description: selectedUser ? "Pengguna berhasil diperbarui" : "Pengguna baru berhasil ditambahkan",
                type: "success",
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.users.importUsers}</DialogTitle>
          </DialogHeader>
          <CsvImport onSuccess={() => { setImportOpen(false); fetchUsers(); }} />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.users.deleteUser}</DialogTitle>
            <DialogDescription>
              {tx("users.deleteConfirm", { name: selectedUser?.name || "" })}
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
