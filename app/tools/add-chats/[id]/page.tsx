"use client";

import { useState, useEffect, use } from "react";
import { ArrowLeft, Download, RefreshCw, AlertCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase/client";
import type { Upload, UploadItem } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UploadDetailsPage({ params }: PageProps) {
  const { id } = use(params);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    fetchUploadData();
    
    // Poll for updates every 2 seconds while processing
    const interval = setInterval(() => {
      if (upload && (upload.status === 'running' || upload.status === 'queued')) {
        fetchUploadData();
      }
    }, 2000);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`upload-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'uploads',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Upload update:', payload);
          if (payload.new) {
            setUpload(payload.new as Upload);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'upload_items',
          filter: `upload_id=eq.${id}`,
        },
        (payload) => {
          console.log('Item update:', payload);
          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new as UploadItem]);
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(item => 
              item.id === (payload.new as UploadItem).id 
                ? payload.new as UploadItem 
                : item
            ));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [id, upload?.status]);

  const fetchUploadData = async () => {
    try {
      const workspaceHash = localStorage.getItem('current_workspace_hash');
      if (!workspaceHash) {
        setError('Sessão expirada. Por favor, volte para a página inicial e valide suas credenciais novamente');
        setLoading(false);
        return;
      }

      // Fetch upload via API with proper workspace context
      const uploadResponse = await fetch(`/api/uploads/${id}`, {
        headers: {
          'x-workspace-hash': workspaceHash,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Erro ao buscar dados do upload');
      }

      const uploadData = await uploadResponse.json();
      setUpload(uploadData.upload);
      setItems(uploadData.items || []);
      
    } catch (error: any) {
      console.error('Error fetching upload data:', error);
      setError('Erro ao carregar dados do upload. Verifique sua conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const response = await fetch(`/api/uploads/${id}/retry-failed`, {
        method: 'POST',
        headers: {
          'x-workspace-hash': localStorage.getItem('current_workspace_hash') || '',
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao reprocessar');
      }
      
      // Refresh data
      await fetchUploadData();
      setError(null);
    } catch (error: any) {
      console.error('Error retrying failed items:', error);
      setError(error.message || 'Erro ao reprocessar itens falhos. Tente novamente');
    }
  };

  const handleDownloadFailures = async () => {
    try {
      const response = await fetch(`/api/uploads/${id}/failures.xlsx`, {
        headers: {
          'x-workspace-hash': localStorage.getItem('current_workspace_hash') || '',
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao gerar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `failures-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading failures:', error);
      setError(error.message || 'Erro ao baixar relatório de falhas. Verifique se há itens com erro');
    }
  };

  const handleCancelUpload = async () => {
    if (!confirm('Tem certeza que deseja cancelar este processamento? Os itens já processados permanecerão salvos.')) {
      return;
    }

    try {
      const response = await fetch(`/api/uploads/${id}/cancel`, {
        method: 'POST',
        headers: {
          'x-workspace-hash': localStorage.getItem('current_workspace_hash') || '',
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao cancelar processamento');
      }

      // Refresh data
      await fetchUploadData();
      setError(null);
    } catch (error: any) {
      console.error('Error canceling upload:', error);
      setError(error.message || 'Erro ao cancelar processamento. Tente novamente');
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'queued': return 'text-gray-500';
      case 'adding': return 'text-blue-500';
      case 'waiting_batch_check': return 'text-purple-500';
      case 'done': return 'text-green-500';
      case 'error': return 'text-red-500';
      // Legacy states (should not appear in new uploads)
      case 'waiting_status': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'queued': return 'Na fila';
      case 'adding': return 'Adicionando';
      case 'waiting_batch_check': return 'Aguardando verificação';
      case 'done': return 'Concluído';
      case 'error': return 'Erro';
      // Legacy states (should not appear in new uploads)
      case 'waiting_status': return 'Verificando (legado)';
      default: return state;
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="p-8">
        <p>Upload não encontrado</p>
      </div>
    );
  }

  const progress = upload.total_rows > 0 
    ? (upload.processed_rows / upload.total_rows) * 100 
    : 0;

  // Pagination calculations
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/tools/add-chats">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Detalhes do Upload</h1>

      {error && (
        <Alert className="mb-6 border-red-500">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Progresso</CardTitle>
            <CardDescription>{upload.filename}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{upload.total_rows}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{upload.total_rows - upload.processed_rows}</p>
                <p className="text-sm text-muted-foreground">Na fila</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{upload.succeeded_rows}</p>
                <p className="text-sm text-muted-foreground">Sucesso</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{upload.failed_rows}</p>
                <p className="text-sm text-muted-foreground">Falhas</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              {upload.failed_rows > 0 && (
                <>
                  <Button 
                    onClick={handleRetryFailed}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reprocessar Falhas
                  </Button>
                  <Button 
                    onClick={handleDownloadFailures}
                    variant="outline"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Falhas
                  </Button>
                </>
              )}
              {(upload.status === 'running' || upload.status === 'queued') && (
                <Button 
                  onClick={handleCancelUpload}
                  variant="destructive"
                  className="gap-2 ml-auto"
                >
                  <XCircle className="h-4 w-4" />
                  Parar Processo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens</CardTitle>
            <CardDescription>
              Mostrando {startIndex + 1}-{Math.min(endIndex, items.length)} de {items.length} itens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Número</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{item.row_index}</td>
                      <td className="p-2">{item.chat_number}</td>
                      <td className="p-2">{item.name}</td>
                      <td className={`p-2 ${getStateColor(item.state)}`}>
                        {getStateLabel(item.state)}
                      </td>
                      <td className="p-2 text-xs">
                        {item.last_error_message || item.chat_add_id || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Os dados deste processamento serão removidos automaticamente após 45 dias
          </p>
        </div>
      </div>
    </div>
  );
}