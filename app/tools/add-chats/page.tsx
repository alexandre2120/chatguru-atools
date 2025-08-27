"use client";

import { useState, useEffect } from "react";
import { Download, Upload, Eye, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { workspaceHash } from "@/utils/hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Upload as UploadType } from "@/types/database";

interface Credentials {
  server: string;
  key: string;
  accountId: string;
  phoneId: string;
}

export default function AddChatsPage() {
  const [credentials, setCredentials] = useState<Credentials>({
    server: "",
    key: "",
    accountId: "",
    phoneId: "",
  });
  const [remember, setRemember] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [hasActiveUploads, setHasActiveUploads] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("chatguru_credentials");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCredentials(parsed);
        setRemember(true);
        fetchUploads(parsed);
      } catch (e) {
        console.error("Failed to load saved credentials");
      }
    }
  }, []);

  const fetchUploads = async (creds: Credentials) => {
    if (!creds.server || !creds.key || !creds.accountId || !creds.phoneId) {
      return;
    }

    setLoadingUploads(true);
    try {
      const hash = await workspaceHash(
        creds.server,
        creds.key,
        creds.accountId,
        creds.phoneId
      );

      const response = await fetch("/api/uploads/list", {
        headers: {
          "x-workspace-hash": hash,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads);
        setHasActiveUploads(data.hasActiveUploads);
      }
    } catch (error) {
      console.error("Error fetching uploads:", error);
    } finally {
      setLoadingUploads(false);
    }
  };

  const handleCredentialChange = async (field: keyof Credentials, value: string) => {
    const newCreds = { ...credentials, [field]: value };
    setCredentials(newCreds);

    if (remember) {
      localStorage.setItem("chatguru_credentials", JSON.stringify(newCreds));
    }

    // Fetch uploads when all credentials are filled
    if (newCreds.server && newCreds.key && newCreds.accountId && newCreds.phoneId) {
      fetchUploads(newCreds);
    }
  };

  const handleRememberChange = (checked: boolean) => {
    setRemember(checked);
    if (checked) {
      localStorage.setItem("chatguru_credentials", JSON.stringify(credentials));
    } else {
      localStorage.removeItem("chatguru_credentials");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/template.xlsx", {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to download template");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "add-chats-template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Erro ao baixar template");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!credentials.server || !credentials.key || !credentials.accountId || !credentials.phoneId) {
      alert("Por favor, preencha todas as credenciais primeiro");
      return;
    }

    if (hasActiveUploads) {
      alert("Você já tem um processamento em andamento. Aguarde a conclusão antes de enviar novos arquivos.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const hash = await workspaceHash(
        credentials.server,
        credentials.key,
        credentials.accountId,
        credentials.phoneId
      );

      // Store workspace hash for use in other pages
      localStorage.setItem("current_workspace_hash", hash);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspace_hash", hash);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      window.location.href = `/tools/add-chats/${result.id}`;
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Erro ao fazer upload do arquivo");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      queued: { label: "Na fila", className: "bg-gray-100 text-gray-800" },
      running: { label: "Processando", className: "bg-blue-100 text-blue-800" },
      completed: { label: "Concluído", className: "bg-green-100 text-green-800" },
      failed: { label: "Falhou", className: "bg-red-100 text-red-800" },
      canceled: { label: "Cancelado", className: "bg-yellow-100 text-yellow-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: "bg-gray-100 text-gray-800",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Add/Import Chats</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Credenciais ChatGuru</CardTitle>
            <CardDescription>Configure suas credenciais de API do ChatGuru</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="server">Servidor (ex: s10)</Label>
                <Input
                  id="server"
                  type="text"
                  placeholder="s10"
                  value={credentials.server}
                  onChange={(e) => handleCredentialChange("server", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key">API Key</Label>
                <Input
                  id="key"
                  type="password"
                  placeholder="sua-api-key"
                  value={credentials.key}
                  onChange={(e) => handleCredentialChange("key", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountId">Account ID</Label>
                <Input
                  id="accountId"
                  type="text"
                  placeholder="account-id"
                  value={credentials.accountId}
                  onChange={(e) => handleCredentialChange("accountId", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneId">Phone ID</Label>
                <Input
                  id="phoneId"
                  type="text"
                  placeholder="phone-id"
                  value={credentials.phoneId}
                  onChange={(e) => handleCredentialChange("phoneId", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) => handleRememberChange(checked as boolean)}
              />
              <Label 
                htmlFor="remember" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Lembrar neste navegador
              </Label>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Processamento: <strong className="text-foreground">1 por minuto</strong> (~10 a cada 10 min)
              </p>
            </div>
          </CardContent>
        </Card>

        {hasActiveUploads && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você tem processamentos em andamento. Aguarde a conclusão antes de enviar novos arquivos.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          <Button 
            onClick={handleDownloadTemplate}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Template XLSX
          </Button>

          <Button 
            asChild
            className="flex items-center gap-2"
            disabled={uploading || hasActiveUploads}
          >
            <label>
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Upload XLSX"}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || hasActiveUploads}
              />
            </label>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Jobs Recentes</CardTitle>
            <CardDescription>Visualize o status dos seus jobs de importação</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUploads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : uploads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Arquivo</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Progresso</th>
                      <th className="text-left p-2">Criado em</th>
                      <th className="text-left p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((upload) => (
                      <tr key={upload.id} className="border-b">
                        <td className="p-2">{upload.filename}</td>
                        <td className="p-2">{getStatusBadge(upload.status)}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {upload.processed_rows}/{upload.total_rows}
                            </span>
                            {upload.failed_rows > 0 && (
                              <span className="text-xs text-red-600">
                                ({upload.failed_rows} falhas)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-xs">{formatDate(upload.created_at)}</td>
                        <td className="p-2">
                          <Link href={`/tools/add-chats/${upload.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1">
                              <Eye className="h-3 w-3" />
                              Ver
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {credentials.server && credentials.key && credentials.accountId && credentials.phoneId
                  ? "Nenhum job encontrado para estas credenciais"
                  : "Preencha as credenciais para ver os jobs"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}