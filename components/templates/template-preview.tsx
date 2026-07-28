"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotificationTemplate } from "@/types";

interface TemplatePreviewProps {
  template: NotificationTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const variables = template.variables || [];

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleData }),
      });
      const data = await res.json();
      if (data.success) {
        setRendered(data.data.rendered.text);
      }
    } catch (error) {
      console.error("Failed to preview:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {variables.length > 0 && (
        <div className="space-y-3">
          <Label>Sample Data</Label>
          {variables.map((variable) => (
            <div key={variable} className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded min-w-[100px]">
                {`{{${variable}}}`}
              </code>
              <Input
                value={sampleData[variable] || ""}
                onChange={(e) =>
                  setSampleData({ ...sampleData, [variable]: e.target.value })
                }
                placeholder={`Sample ${variable}`}
              />
            </div>
          ))}
        </div>
      )}

      <Button onClick={handlePreview} disabled={loading}>
        {loading ? "Loading..." : "Preview"}
      </Button>

      {rendered && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rendered Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
              {rendered}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Original Template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
            {template.content.text}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
