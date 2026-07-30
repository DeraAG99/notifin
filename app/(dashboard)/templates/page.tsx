"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Pencil, Trash2, Eye, MessageSquare, Mail, Layers } from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import { EmptyState } from "@/components/shared/empty-state";
import type { NotificationTemplate } from "@/types";

export default function TemplatesPage() {
  const router = useRouter();
  const { t, tx } = useI18n();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.success) setTemplates(data.data);
    } catch {
      toast.add({ title: t.common.error, description: "Gagal memuat template", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filtered = templates.filter(
    (tmpl) =>
      tmpl.name.toLowerCase().includes(search.toLowerCase()) ||
      tmpl.channel.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.deleted, description: `"${selectedTemplate.name}" berhasil dihapus`, type: "success" });
        fetchTemplates();
      } else {
        toast.add({ title: t.common.error, description: data.error || "Gagal menghapus", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal menghapus template", type: "error" });
    }
    setDeleteOpen(false);
    setSelectedTemplate(null);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "wa": return <MessageSquare className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      default: return <Layers className="h-4 w-4" />;
    }
  };

  const getChannelBadgeVariant = (channel: string): "default" | "secondary" | "outline" => {
    switch (channel) {
      case "wa": return "default";
      case "email": return "secondary";
      default: return "outline";
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "wa": return "WA";
      case "email": return "Email";
      default: return t.templates.channelLabel.both;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.templates.title}</h1>
          <p className="text-muted-foreground">{t.templates.description}</p>
        </div>
        <Button onClick={() => window.open("/templates/new", "_blank")}>
          <Plus className="h-4 w-4 mr-2" /> {t.templates.newTemplate}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.templates.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {tx("templates.templateCount", { count: filtered.length })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t.templates.noTemplates}
          description={t.templates.noTemplatesDesc}
          actionLabel={t.templates.createTemplate}
          actionHref="#"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <Card key={template.id} className="relative group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(template.channel)}
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  <Badge variant={getChannelBadgeVariant(template.channel)}>
                    {getChannelLabel(template.channel)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.content.text.substring(0, 100)}...
                </p>

                {template.variables && template.variables.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {template.variables.slice(0, 3).map((v) => (
                      <Badge key={v} variant="outline" className="text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                    {template.variables.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.variables.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge variant={template.isActive ? "default" : "secondary"}>
                    {template.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setSelectedTemplate(template); setPreviewOpen(true); }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(`/templates/${template.id}?edit=true`, "_blank")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setSelectedTemplate(template); setDeleteOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tx("templates.previewTitle", { name: selectedTemplate?.name || "" })}</DialogTitle>
          </DialogHeader>
          {selectedTemplate && <TemplatePreview template={selectedTemplate} />}
        </DialogContent>
      </Dialog>

      {/* Dialog Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.templates.deleteTemplate}</DialogTitle>
            <DialogDescription>
              {tx("templates.deleteConfirm", { name: selectedTemplate?.name || "" })}
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
