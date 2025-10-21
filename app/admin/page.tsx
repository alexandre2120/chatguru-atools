"use client";

import { useState, useEffect } from "react";
import { Shield, Activity, Database, AlertCircle, RefreshCw, Eye, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatGuruLogo } from "@/components/chatguru-logo";

interface UploadItem {
  id: string;
  upload_id: string;
  workspace_hash: string;
  row_index: number;
  chat_number: string;
  name: string;
  state: string;
  chat_add_id?: string | null;
  last_error_message?: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

interface RunLog {
  id: number;
  workspace_hash: string;
  upload_id?: string | null;
  item_id?: string | null;
  phase: string;
  level: string;
  message?: string | null;
  code?: number | null;
  at: string;
}

interface Stats {
  totalUploads: number;
  activeUploads: number;
  totalItems: number;
  itemsByState: Record<string, number>;
}

interface Upload {
  id: string;
  filename: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  succeeded_rows: number;
  failed_rows: number;
  workspace_hash: string;
  created_at: string;
}

interface Workspace {
  workspace_hash: string;
  created_at: string;
  totalUploads: number;
  activeUploads: number;
  totalItems: number;
  itemsByState: Record<string, number>;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Dashboard data
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentItems, setRecentItems] = useState<UploadItem[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [uploadsPage, setUploadsPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [uploadsTotalPages, setUploadsTotalPages] = useState(1);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  
  const [activeTab, setActiveTab] = useState("overview");
  const [uploadStatusFilter, setUploadStatusFilter] = useState<string>("");
  const [itemStateFilter, setItemStateFilter] = useState<string>("");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const savedSecret = sessionStorage.getItem("admin_secret");
    if (savedSecret) {
      setSecret(savedSecret);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchAllData();
    }
  }, [authenticated, activeTab, uploadsPage, itemsPage, logsPage, uploadStatusFilter, itemStateFilter, workspaceFilter, searchTerm]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (authenticated && autoRefresh) {
      interval = setInterval(() => {
        fetchAllData();
      }, 5000); // Refresh every 5 seconds
    }
    return () => clearInterval(interval);
  }, [authenticated, autoRefresh, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ secret }),
      });

      const result = await response.json();

      if (result.authenticated) {
        sessionStorage.setItem("admin_secret", secret);
        setAuthenticated(true);
      } else {
        setError("Secret inválido. Acesso negado.");
      }
    } catch (err) {
      setError("Erro ao autenticar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_secret");
    setAuthenticated(false);
    setSecret("");
  };

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/admin/dashboard", {
        headers: {
          "x-admin-secret": secret,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          return;
        }
        throw new Error("Erro ao carregar dados");
      }

      const data = await response.json();
      setStats(data.stats);
      setRecentItems(data.recentItems);
    } catch (err) {
      console.error("Error fetching dashboard:", err);
    }

    // Fetch logs
    try {
      const response = await fetch(`/api/admin/logs?page=${logsPage}&limit=100`, {
        headers: {
          "x-admin-secret": secret,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setLogsTotal(data.total);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const fetchUploads = async () => {
    try {
      const params = new URLSearchParams({
        page: uploadsPage.toString(),
        limit: "50",
        ...(uploadStatusFilter && { status: uploadStatusFilter }),
        ...(workspaceFilter && { workspace_hash: workspaceFilter }),
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/admin/uploads?${params}`, {
        headers: { "x-admin-secret": secret },
      });

      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads);
        setUploadsTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error("Error fetching uploads:", err);
    }
  };

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams({
        page: itemsPage.toString(),
        limit: "50",
        ...(itemStateFilter && { state: itemStateFilter }),
        ...(workspaceFilter && { workspace_hash: workspaceFilter }),
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/admin/items?${params}`, {
        headers: { "x-admin-secret": secret },
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
        setItemsTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/admin/workspaces", {
        headers: { "x-admin-secret": secret },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces);
      }
    } catch (err) {
      console.error("Error fetching workspaces:", err);
    }
  };

  const fetchAllData = async () => {
    if (activeTab === "overview") {
      await fetchDashboardData();
    } else if (activeTab === "uploads") {
      await fetchUploads();
    } else if (activeTab === "items") {
      await fetchItems();
    } else if (activeTab === "logs") {
      // Logs are fetched in fetchDashboardData
    } else if (activeTab === "workspaces") {
      await fetchWorkspaces();
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "queued": return "bg-gray-500";
      case "adding": return "bg-blue-500";
      case "waiting_batch_check": return "bg-purple-500";
      case "done": return "bg-green-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued": return "bg-gray-500";
      case "running": return "bg-blue-500";
      case "checking": return "bg-purple-500";
      case "completed": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "canceled": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "info": return "bg-blue-500";
      case "warn": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Login Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto">
              <ChatGuruLogo className="justify-center" />
            </div>
            <CardTitle className="text-2xl">Admin Access</CardTitle>
            <CardDescription>Digite o secret para acessar o painel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Admin Secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="text-center"
                  autoFocus
                />
              </div>

              {error && (
                <Alert className="border-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading || !secret}>
                {loading ? "Verificando..." : "Acessar Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <ChatGuruLogo />
            <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Shield className="h-6 w-6" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Monitoramento em tempo real do sistema</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllData}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total de Uploads</CardDescription>
                <CardTitle className="text-3xl">{stats.totalUploads}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Uploads Ativos</CardDescription>
                <CardTitle className="text-3xl text-blue-600">{stats.activeUploads}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total de Itens</CardDescription>
                <CardTitle className="text-3xl">{stats.totalItems}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Na Fila</CardDescription>
                <CardTitle className="text-3xl text-purple-600">
                  {stats.itemsByState.queued || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Items by State */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Distribuição por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.itemsByState).map(([state, count]) => (
                  <div key={state} className="flex items-center gap-2">
                    <Badge className={getStateColor(state)}>{state}</Badge>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Itens Recentes (últimos 50)
            </CardTitle>
            <CardDescription>Itens sendo processados no momento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Chat Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Chat Add ID</TableHead>
                    <TableHead>Última Atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.row_index}</TableCell>
                      <TableCell className="font-mono text-xs">{item.chat_number}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge className={getStateColor(item.state)}>{item.state}</Badge>
                      </TableCell>
                      <TableCell>{item.attempts}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.chat_add_id ? item.chat_add_id.substring(0, 12) + "..." : "-"}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(item.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {recentItems.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhum item recente</p>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Logs do Sistema
            </CardTitle>
            <CardDescription>
              Página {logsPage} • Total: {logsTotal} logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Workspace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.id}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(log.at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.phase}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getLevelColor(log.level)}>{log.level}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={log.message || ""}>
                        {log.message || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.workspace_hash.substring(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {logs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                disabled={logsPage === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {logsPage} de {Math.ceil(logsTotal / 100)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogsPage((p) => p + 1)}
                disabled={logsPage >= Math.ceil(logsTotal / 100)}
              >
                Próxima
              </Button>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Uploads Tab */}
          <TabsContent value="uploads" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Uploads</CardTitle>
                <CardDescription>Lista de todos os uploads com filtros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Select value={uploadStatusFilter} onValueChange={(v) => setUploadStatusFilter(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Buscar por filename..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Taxa Sucesso</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploads.map((upload) => (
                        <TableRow key={upload.id}>
                          <TableCell className="font-medium">{upload.filename}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(upload.status)}>{upload.status}</Badge>
                          </TableCell>
                          <TableCell>{upload.processed_rows}/{upload.total_rows}</TableCell>
                          <TableCell>
                            {upload.total_rows > 0 
                              ? `${((upload.succeeded_rows / upload.total_rows) * 100).toFixed(1)}%`
                              : '0%'}
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(upload.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {uploads.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum upload encontrado</p>
                  )}
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setUploadsPage(p => Math.max(1, p - 1))}
                    disabled={uploadsPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {uploadsPage} de {uploadsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setUploadsPage(p => p + 1)}
                    disabled={uploadsPage >= uploadsTotalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>Lista de todos os itens com filtros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Select value={itemStateFilter} onValueChange={(v) => setItemStateFilter(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="adding">Adding</SelectItem>
                      <SelectItem value="waiting_batch_check">Waiting Check</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Buscar por nome ou número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chat Number</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Tentativas</TableHead>
                        <TableHead>Atualizado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.chat_number}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <Badge className={getStateColor(item.state)}>{item.state}</Badge>
                          </TableCell>
                          <TableCell>{item.attempts}</TableCell>
                          <TableCell className="text-xs">{formatDate(item.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {items.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum item encontrado</p>
                  )}
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setItemsPage(p => Math.max(1, p - 1))}
                    disabled={itemsPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {itemsPage} de {itemsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setItemsPage(p => p + 1)}
                    disabled={itemsPage >= itemsTotalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace) => (
                <Card key={workspace.workspace_hash}>
                  <CardHeader>
                    <CardTitle className="text-sm font-mono">
                      {workspace.workspace_hash.substring(0, 16)}...
                    </CardTitle>
                    <CardDescription>
                      Criado em {formatDate(workspace.created_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Uploads:</span>
                      <span className="font-semibold">{workspace.totalUploads}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ativos:</span>
                      <span className="font-semibold text-blue-600">{workspace.activeUploads}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Items:</span>
                      <span className="font-semibold">{workspace.totalItems}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Estados:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(workspace.itemsByState).map(([state, count]) => (
                          <Badge key={state} variant="outline" className="text-xs">
                            {state}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        setWorkspaceFilter(workspace.workspace_hash);
                        setActiveTab("uploads");
                      }}
                    >
                      Ver Uploads
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {workspaces.length === 0 && (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">Nenhum workspace encontrado</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
