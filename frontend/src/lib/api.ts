const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface FileItem {
  id: number;
  file_path: string;
  filename: string;
  file_size: number;
  extension: string;
  mime_type: string;
  category: string;
  summary?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DirectoryNode {
  name: string;
  children: DirectoryNode;
}

export interface DirectoryTree {
  folders: Array<{ name: string; children: DirectoryTree }>;
  files: FileItem[];
}

export interface DirectoryTreeResponse {
  total_files: number;
  tree: DirectoryTree;
}

export interface DirectoryContentsResponse {
  path: string;
  folders: string[];
  files: FileItem[];
}

export interface ActionItem {
  id: number;
  file_id: number;
  filename: string;
  action_type: string;
  source_path: string;
  target_path: string;
  category: string;
  reasoning: string;
  status: string;
  created_at: string;
  executed_at?: string;
}

export interface StatsResponse {
  total_files: number;
  total_bytes: number;
  categories: Record<string, number>;
  statuses: Record<string, number>;
}

export interface HealthResponse {
  lm_studio: {
    status: string;
    endpoint: string;
    available_models?: string[];
    error?: string;
  };
  searxng: {
    status: string;
    endpoint: string;
    error?: string;
  };
}

export async function fetchDirectoryTree(): Promise<DirectoryTreeResponse> {
  const res = await fetch(`${API_BASE}/api/files/tree`);
  if (!res.ok) throw new Error('Failed to fetch directory tree');
  return res.json();
}

export async function fetchDirectoryContents(path: string): Promise<DirectoryContentsResponse> {
  const res = await fetch(`${API_BASE}/api/files/dir?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Failed to fetch directory contents');
  return res.json();
}

export async function fetchFiles(category?: string, status?: string, search?: string, limit: number = 100): Promise<{ total: number; items: FileItem[] }> {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (status && status !== 'All') params.append('status', status);
  if (search) params.append('search', search);
  params.append('limit', limit.toString());

  const res = await fetch(`${API_BASE}/api/files/?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/api/files/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchFileDetails(fileId: number) {
  const res = await fetch(`${API_BASE}/api/files/${fileId}/details`);
  if (!res.ok) throw new Error('Failed to fetch file details');
  return res.json();
}

export async function triggerScan(targetPath?: string, forceRescan: boolean = true) {
  const res = await fetch(`${API_BASE}/api/files/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_path: targetPath, force_rescan: forceRescan }),
  });
  if (!res.ok) throw new Error('Failed to trigger scan');
  return res.json();
}

export async function categorizeFile(fileId: number, customPrompt?: string) {
  const res = await fetch(`${API_BASE}/api/categorize/file/${fileId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_prompt: customPrompt }),
  });
  if (!res.ok) throw new Error('Failed to categorize file');
  return res.json();
}

export async function categorizeBatch(limit: number = 10, fileIds?: number[], customPrompt?: string) {
  const res = await fetch(`${API_BASE}/api/categorize/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit, file_ids: fileIds, custom_prompt: customPrompt }),
  });
  if (!res.ok) throw new Error('Failed to categorize batch');
  return res.json();
}

export async function sendAssistantChat(
  message: string,
  fileIds?: number[],
  history?: { role: string; content: string }[]
) {
  const res = await fetch(`${API_BASE}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, file_ids: fileIds, history }),
  });
  if (!res.ok) throw new Error('Failed to send message to AI Assistant');
  return res.json();
}

export async function fetchQueue(status?: string): Promise<{ total: number; items: ActionItem[] }> {
  const params = new URLSearchParams();
  if (status && status !== 'All') params.append('status', status);

  const res = await fetch(`${API_BASE}/api/queue/?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function approveAction(actionId: number) {
  const res = await fetch(`${API_BASE}/api/queue/${actionId}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to approve action');
  return res.json();
}

export async function rejectAction(actionId: number) {
  const res = await fetch(`${API_BASE}/api/queue/${actionId}/reject`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reject action');
  return res.json();
}

export async function executeAction(actionId: number) {
  const res = await fetch(`${API_BASE}/api/queue/${actionId}/execute`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to execute action');
  return res.json();
}

export async function executeAllApproved() {
  const res = await fetch(`${API_BASE}/api/queue/execute-all-approved`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to execute approved actions');
  return res.json();
}

export async function clearQueue(status?: string) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  const res = await fetch(`${API_BASE}/api/queue/clear?${params.toString()}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear queue');
  return res.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/settings/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}
