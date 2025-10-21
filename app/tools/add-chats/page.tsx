"use client";

import { useState, useEffect } from "react";
import { Download, Upload, Eye, AlertCircle, Loader2, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { workspaceHash } from "@/utils/hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { Upload as UploadType } from "@/types/database";

// Processing configuration - matches the backend rate limiting
const PROCESSING_CONFIG = {
  RATE_LIMIT_SECONDS: 10,    // 1 request per 10 seconds per workspace (from tick route)
  CRON_INTERVAL_MINUTES: 1,  // Cron runs every minute (from vercel.json)
  TARGET_PER_10MIN: 60,      // Target throughput: 6 per minute = 60 per 10 minutes
} as const;

interface Credentials {
  server: string;
  key: string;
  accountId: string;
  phoneId: string;
}

interface UsageInfo {
  total: number;
  limit: number;
  remaining: number;
  percentage: number;
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
  const [credentialsValidated, setCredentialsValidated] = useState(false);
  const [validatingCredentials, setValidatingCredentials] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("chatguru_credentials");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCredentials(parsed);
        setRemember(true);
        // Don't fetch uploads automatically, require credential validation
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
    
    // Reset validation state when credentials change
    setCredentialsValidated(false);
    setCredentialError(null);

    if (remember) {
      localStorage.setItem("chatguru_credentials", JSON.stringify(newCreds));
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

  const handleCheckCredentials = async () => {
    if (!credentials.server || !credentials.key || !credentials.accountId || !credentials.phoneId) {
      setCredentialError("Por favor, preencha todas as credenciais");
      return;
    }

    setValidatingCredentials(true);
    setCredentialError(null);

    try {
      const response = await fetch("/api/check-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (result.valid) {
        setCredentialsValidated(true);
        setUploads(result.uploads);
        setHasActiveUploads(result.hasActiveUploads);
        setUsage(result.usage || null);
        setLimitReached(result.limitReached || false);
        
        // Store workspace hash for future use
        if (result.workspaceHash) {
          localStorage.setItem("current_workspace_hash", result.workspaceHash);
        }

        if (result.limitReached) {
          setCredentialError(result.error);
        } else if (result.hasActiveUploads) {
          setCredentialError("Você tem processamentos em andamento. Aguarde a conclusão para enviar novos arquivos.");
        }
      } else {
        setCredentialsValidated(false);
        setCredentialError(result.error || "Credenciais inválidas");
        setUsage(null);
        setLimitReached(false);
      }
    } catch (error) {
      console.error("Error checking credentials:", error);
      setCredentialError("Erro ao verificar credenciais");
      setCredentialsValidated(false);
    } finally {
      setValidatingCredentials(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/template.xlsx", {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar template");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "add-chats-template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error("Error downloading template:", error);
      setCredentialError(error.message || "Erro ao baixar template. Tente novamente");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!credentialsValidated) {
      setCredentialError("Por favor, valide suas credenciais primeiro clicando em 'Checar credencial'");
      e.target.value = "";
      return;
    }

    if (limitReached) {
      setCredentialError("Limite de 50.000 contatos atingido para este Account ID. Não é possível enviar novos arquivos.");
      e.target.value = "";
      return;
    }

    if (hasActiveUploads) {
      setCredentialError("Você já tem um processamento em andamento. Aguarde a conclusão antes de enviar novos arquivos.");
      e.target.value = "";
      return;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setCredentialError("Por favor, envie apenas arquivos Excel (.xlsx)");
      e.target.value = "";
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setCredentialError("O arquivo é muito grande. Tamanho máximo: 10MB");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setCredentialError(null);
    
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
      formData.append("key", credentials.key);
      formData.append("phone_id", credentials.phoneId);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        // Show specific error message from API
        throw new Error(result.error || "Erro ao processar o arquivo");
      }

      window.location.href = `/tools/add-chats/${result.id}`;
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setCredentialError(error.message || "Erro ao fazer upload do arquivo. Verifique o formato da planilha");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      queued: { label: "Na fila", className: "bg-gray-100 text-gray-800" },
      running: { label: "Processando", className: "bg-blue-100 text-blue-800" },
      checking: { label: "Verificando", className: "bg-purple-100 text-purple-800" },
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

  const getProcessingRateInfo = () => {
    const { RATE_LIMIT_SECONDS, CRON_INTERVAL_MINUTES, TARGET_PER_10MIN } = PROCESSING_CONFIG;
    
    // Calculate actual rate based on system constraints
    const effectiveRatePerMinute = 60 / RATE_LIMIT_SECONDS; // 60 seconds / rate limit in seconds
    const actualPer10Min = Math.floor(effectiveRatePerMinute * 10);
    
    return {
      rateText: RATE_LIMIT_SECONDS === 10
        ? "1 a cada 10 segundos"
        : RATE_LIMIT_SECONDS === 60
        ? "1 por minuto"
        : RATE_LIMIT_SECONDS < 60
        ? `1 a cada ${RATE_LIMIT_SECONDS} segundos`
        : `1 a cada ${Math.ceil(RATE_LIMIT_SECONDS/60)} minutos`,
      estimateText: `~${actualPer10Min} a cada 10 min`,
      isOptimal: actualPer10Min >= TARGET_PER_10MIN
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-foreground">Add/Import Chats</h1>
        
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

            <div className="flex items-center justify-between">
              <Button
                onClick={handleCheckCredentials}
                disabled={validatingCredentials || !credentials.server || !credentials.key || !credentials.accountId || !credentials.phoneId}
                className="flex items-center gap-2"
              >
                {validatingCredentials ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    {credentialsValidated ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    Checar credencial
                  </>
                )}
              </Button>

              {credentialsValidated && !limitReached && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Credenciais válidas
                </div>
              )}
              
              {limitReached && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <XCircle className="h-4 w-4" />
                  Limite atingido
                </div>
              )}
            </div>

            {credentialError && (
              <Alert className={limitReached ? "border-red-500" : credentialsValidated && hasActiveUploads ? "border-yellow-500" : "border-red-500"}>
                {limitReached ? <XCircle className="h-4 w-4 text-red-500" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  {credentialError}
                </AlertDescription>
              </Alert>
            )}

            {usage && credentialsValidated && (
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Uso do Account ID</span>
                  <span className="text-sm text-muted-foreground">
                    {usage.total.toLocaleString('pt-BR')} / {usage.limit.toLocaleString('pt-BR')}
                  </span>
                </div>
                <Progress 
                  value={usage.percentage} 
                  className={`h-2 ${usage.percentage >= 90 ? 'bg-red-100' : usage.percentage >= 75 ? 'bg-yellow-100' : ''}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {usage.percentage >= 100 
                      ? 'Limite atingido' 
                      : `${usage.remaining.toLocaleString('pt-BR')} contatos restantes`}
                  </span>
                  <span>{usage.percentage.toFixed(1)}% usado</span>
                </div>
                {usage.percentage >= 90 && usage.percentage < 100 && (
                  <Alert className="border-yellow-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Atenção: Você está próximo do limite de 50.000 contatos
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-1">
              <p className="text-sm text-muted-foreground">
                Processamento: <strong className="text-foreground">{getProcessingRateInfo().rateText}</strong> ({getProcessingRateInfo().estimateText})
              </p>
              <p className="text-xs text-muted-foreground">
                Dados são automaticamente removidos após 45 dias • O uso do limite é permanente
              </p>
            </div>
          </CardContent>
        </Card>

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
            disabled={uploading || hasActiveUploads || !credentialsValidated || limitReached}
            title={!credentialsValidated ? "Valide suas credenciais primeiro" : limitReached ? "Limite de 50.000 contatos atingido" : hasActiveUploads ? "Aguarde conclusão do processamento atual" : "Fazer upload de arquivo XLSX"}
          >
            <label>
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Upload XLSX"}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || hasActiveUploads || !credentialsValidated}
              />
            </label>
          </Button>

          <Button
            asChild
            variant="secondary"
            className="flex items-center gap-2"
          >
            <a href="https://links.chatguru.com.br/atools" target="_blank" rel="noopener noreferrer">
              Tutorial
            </a>
          </Button>
        </div>

        {credentialsValidated && (
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
        )}
        </div>
      </div>
    </div>
  );
}
