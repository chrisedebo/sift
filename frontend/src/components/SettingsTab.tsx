'use client';

import React from 'react';
import { HealthResponse } from '../lib/api';

interface SettingsTabProps {
  batchChunkSize: number;
  setBatchChunkSize: (size: number) => void;
  health: HealthResponse | null;
  onTestConnections: () => void;
}

export default function SettingsTab({
  batchChunkSize,
  setBatchChunkSize,
  health,
  onTestConnections
}: SettingsTabProps) {
  return (
    <div className="bg-[#131b2e] border border-gray-800 rounded-xl p-6 space-y-6 max-w-2xl">
      <h2 className="text-sm font-semibold text-gray-200">System Integration & Processing Settings</h2>

      <div className="space-y-4 text-xs">
        <div>
          <label className="block text-gray-400 mb-1">AI Batch Processing Chunk Size (Files per API call)</label>
          <select
            value={batchChunkSize}
            onChange={(e) => setBatchChunkSize(Number(e.target.value))}
            className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-2 text-gray-200 font-mono outline-none"
          >
            <option value={5}>5 files per chunk (Slowest, lightest load)</option>
            <option value={10}>10 files per chunk (Recommended)</option>
            <option value={25}>25 files per chunk</option>
            <option value={50}>50 files per chunk</option>
            <option value={100}>100 files per chunk (Fastest, requires strong local GPU)</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-1">Controls how many files are sent to LM Studio in each batch loop request.</p>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">LM Studio Endpoint (OpenAI API Compatible)</label>
          <input
            type="text"
            defaultValue={health?.lm_studio?.endpoint || 'http://localhost:1234/v1'}
            className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-2 text-gray-200 font-mono outline-none"
          />
          <p className="text-[11px] text-gray-500 mt-1">Connects to local LM Studio or cloud providers (OpenAI, Gemini, Ollama).</p>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">SearXNG Web Search Engine Endpoint</label>
          <input
            type="text"
            defaultValue={health?.searxng?.endpoint || 'http://localhost:8080'}
            className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-2 text-gray-200 font-mono outline-none"
          />
          <p className="text-[11px] text-gray-500 mt-1">Queries SearXNG JSON API for metadata enrichment.</p>
        </div>

        <div className="pt-2">
          <button
            onClick={onTestConnections}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            Test Service Connections
          </button>
        </div>
      </div>
    </div>
  );
}
