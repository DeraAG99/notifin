"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { NotificationTemplate } from "@/types";

interface TemplateFormProps {
  template?: NotificationTemplate | null;
  onSuccess: () => void;
}

export function TemplateForm({ template, onSuccess }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || "");
  const [channel, setChannel] = useState<"wa" | "email" | "both">(template?.channel || "wa");
  const [subject, setSubject] = useState(template?.subject || "");
  const [contentText, setContentText] = useState(template?.content?.text || "");
  const [contentHtml, setContentHtml] = useState(template?.content?.html || "");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const variables = contentText.match(/\{\{(\w+)\}\}/g)?.map((v) => v.replace(/\{\{|\}\}/g, "")) || [];

    const body = {
      name,
      channel,
      subject: channel !== "wa" ? subject : null,
      content: { text: contentText, html: contentHtml || undefined },
      variables: [...new Set(variables)],
      isActive,
    };

    try {
      const url = template ? `/api/templates/${template.id}` : "/api/templates";
      const method = template ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as "wa" | "email" | "both")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wa">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="both">Both (WA + Email)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {channel !== "wa" && (
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject (supports {{variables}})"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          placeholder="Hello {{name}}, your notification..."
          rows={5}
          required
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{variable}}"} for dynamic content
        </p>
      </div>

      {channel !== "wa" && (
        <div className="space-y-2">
          <Label htmlFor="html">HTML (optional)</Label>
          <Textarea
            id="html"
            value={contentHtml}
            onChange={(e) => setContentHtml(e.target.value)}
            placeholder="<h1>Hello {{name}}</h1>"
            rows={5}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          id="active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : template ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
