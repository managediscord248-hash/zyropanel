import React, { useState, useEffect } from 'react';
import { TemplateItem } from '../types';
import { api } from '../services/api';
import { Layers, Plus, Sparkles, X, Check } from 'lucide-react';

export const Templates: React.FC<{ onUseTemplate?: (tmpl: TemplateItem) => void }> = ({ onUseTemplate }) => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [game, setGame] = useState('Minecraft');
  const [description, setDescription] = useState('');
  const [dockerImage, setDockerImage] = useState('itzg/minecraft-server:latest');
  const [defaultPort, setDefaultPort] = useState(25565);
  const [defaultRam, setDefaultRam] = useState(2048);
  const [defaultCpu, setDefaultCpu] = useState(2.0);
  const [startupCommand, setStartupCommand] = useState('java -jar server.jar nogui');

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTemplate({
        name,
        game,
        description,
        docker_image: dockerImage,
        default_port: Number(defaultPort),
        default_ram_mb: Number(defaultRam),
        default_cpu_limit: Number(defaultCpu),
        startup_command: startupCommand,
        environment_variables: '{}',
        config_templates: '{}'
      });
      setShowAddModal(false);
      setName('');
      setDescription('');
      loadTemplates();
    } catch (err: any) {
      alert(`Error creating template: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide flex items-center gap-2">
            <span>GAME SERVER TEMPLATES LIBRARY</span>
            <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {templates.length} TEMPLATES
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-configured Docker images, launch parameters, and environment schemas for instant deployment.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>NEW TEMPLATE</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-5 flex flex-col justify-between hover:border-cyan-500/30 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  {tmpl.game}
                </span>
                <span className="text-xs font-mono text-slate-400">Port {tmpl.default_port}</span>
              </div>

              <h3 className="font-bold text-white text-sm mb-1.5">{tmpl.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                {tmpl.description}
              </p>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1 mb-4">
                <div className="truncate text-slate-400">Image: {tmpl.docker_image}</div>
                <div className="text-cyan-400">Min RAM: {tmpl.default_ram_mb} MB</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-500 truncate">
                Command: {tmpl.startup_command}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Template Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0c121e] p-5 sm:p-6 text-xs shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-white font-['Rajdhani',sans-serif] text-base uppercase">
                Create Custom Game Template
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Template Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Factorio Dedicated"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Game Category</label>
                  <input
                    type="text"
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    required
                    placeholder="e.g. Factorio"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Docker Image</label>
                <input
                  type="text"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Default Port</label>
                  <input
                    type="number"
                    value={defaultPort}
                    onChange={(e) => setDefaultPort(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">RAM (MB)</label>
                  <input
                    type="number"
                    value={defaultRam}
                    onChange={(e) => setDefaultRam(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">vCPU Cores</label>
                  <input
                    type="number"
                    step="0.5"
                    value={defaultCpu}
                    onChange={(e) => setDefaultCpu(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Startup Command</label>
                <input
                  type="text"
                  value={startupCommand}
                  onChange={(e) => setStartupCommand(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition-all"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
