import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { CreditCard, Check, ExternalLink, Save } from 'lucide-react';

interface PayMongoConfig {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  webhookUrl: string;
  isConfigured: boolean;
  proSubscriptionPrice: number; // in centavos
}

export default function AdminPayMongo() {
  const [config, setConfig] = useState<PayMongoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [secretKey, setSecretKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [proPrice, setProPrice] = useState('');

  useEffect(() => {
    api.get('/admin/paymongo')
      .then((res) => {
        setConfig(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/paymongo', {
        secretKey: secretKey || undefined,
        publicKey: publicKey || undefined,
        webhookSecret: webhookSecret || undefined,
        proSubscriptionPrice: proPrice !== '' ? parseFloat(proPrice) : undefined,
      });
      setSaved(true);
      setSecretKey('');
      setPublicKey('');
      setWebhookSecret('');
      setProPrice('');
      setTimeout(() => setSaved(false), 3000);
      const res = await api.get('/admin/paymongo');
      setConfig(res.data);
    } catch {} finally { setSaving(false); }
  };

  const copyWebhookUrl = () => {
    if (config?.webhookUrl) {
      navigator.clipboard.writeText(config.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">PayMongo Settings</h1>

      {/* Status card */}
      <div className={`card p-4 ${config?.isConfigured ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config?.isConfigured ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
            {config?.isConfigured ? (
              <Check size={20} className="text-green-400" />
            ) : (
              <CreditCard size={20} className="text-yellow-400" />
            )}
          </div>
          <div>
            <p className={`font-semibold text-sm ${config?.isConfigured ? 'text-green-400' : 'text-yellow-400'}`}>
              {config?.isConfigured ? 'PayMongo Configured' : 'PayMongo Not Configured'}
            </p>
            <p className="text-xs text-gray-400">
              {config?.isConfigured
                ? 'Payments are active. Keys stored in database.'
                : 'Enter your PayMongo API keys below to enable payments.'}
            </p>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink size={18} className="text-triq-cyan" />
          <h3 className="text-sm font-semibold text-white">Webhook URL</h3>
        </div>
        <p className="text-xs text-gray-400">
          Copy this URL and paste it into your PayMongo Dashboard → Developers → Webhooks.
          Select events: <span className="text-triq-cyan">source.chargeable</span>,{' '}
          <span className="text-triq-cyan">payment.paid</span>,{' '}
          <span className="text-triq-cyan">payment.failed</span>
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-triq-cyan text-xs font-mono break-all">
            {config?.webhookUrl || 'https://triq.dpdns.org/api/v1/tips/webhook'}
          </code>
          <button
            onClick={copyWebhookUrl}
            className="px-3 py-2 rounded-lg bg-triq-cyan/20 text-triq-cyan text-xs font-medium whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* API Keys form */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-triq-cyan" />
          <h3 className="text-sm font-semibold text-white">API Credentials</h3>
        </div>

        {/* Current values (masked) */}
        {config && (config.secretKey || config.publicKey) && (
          <div className="space-y-2 p-3 rounded-lg bg-triq-dark/50 border border-triq-light/10">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Current Keys (masked)</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Secret Key:</span>
              <span className="text-white font-mono">{config.secretKey || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Public Key:</span>
              <span className="text-white font-mono">{config.publicKey || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Webhook Secret:</span>
              <span className="text-white font-mono">{config.webhookSecret ? '****' : '—'}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Enter new values below to update. Leave a field blank to keep the existing value.
        </p>

        {/* Secret Key */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400">Secret Key <span className="text-triq-cyan">(required for payments)</span></label>
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="sk_live_xxxxxxxx or sk_test_xxxxxxxx"
            className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm font-mono"
          />
          <p className="text-[10px] text-gray-500">Found in PayMongo Dashboard → Developers → API Keys</p>
        </div>

        {/* Public Key */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400">Public Key</label>
          <input
            type="password"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="pk_live_xxxxxxxx or pk_test_xxxxxxxx"
            className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm font-mono"
          />
          <p className="text-[10px] text-gray-500">Found in PayMongo Dashboard → Developers → API Keys</p>
        </div>

        {/* Webhook Secret */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400">Webhook Secret</label>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="whsec_xxxxxxxx"
            className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm font-mono"
          />
          <p className="text-[10px] text-gray-500">Found in PayMongo Dashboard → Developers → Webhooks → your webhook</p>
        </div>

        {/* PRO Subscription Price */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400">
            PRO Subscription Price <span className="text-triq-cyan">(₱/month)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
            <input
              type="number"
              min="100"
              step="1"
              value={proPrice}
              onChange={(e) => setProPrice(e.target.value)}
              placeholder={config ? String(config.proSubscriptionPrice / 100) : '50'}
              className="w-full h-10 pl-7 pr-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
            />
          </div>
          <p className="text-[10px] text-gray-500">
            Current price: <span className="text-white font-medium">₱{config ? (config.proSubscriptionPrice / 100).toFixed(2) : '50.00'}/month</span>
            {' '}· Minimum ₱100. Leave blank to keep current.
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving || (!secretKey && !publicKey && !webhookSecret && proPrice === '')}
          className="w-full h-10 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? 'Saving...' : saved ? (
            <><Check size={16} /> Saved!</>
          ) : (
            <><Save size={16} /> Save Credentials</>
          )}
        </button>
      </div>

      {/* Setup guide */}
      <div className="card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white">Setup Guide</h3>
        <ol className="space-y-2 text-xs text-gray-400 list-decimal list-inside">
          <li>Go to <a href="https://dashboard.paymongo.com/" target="_blank" rel="noopener noreferrer" className="text-triq-cyan hover:underline">PayMongo Dashboard</a></li>
          <li>Navigate to <strong className="text-gray-300">Developers → API Keys</strong> — copy your Secret Key and Public Key</li>
          <li>Navigate to <strong className="text-gray-300">Developers → Webhooks → Create Webhook</strong></li>
          <li>Set the URL to the webhook URL shown above</li>
          <li>Select events: <span className="text-triq-cyan">source.chargeable</span>, <span className="text-triq-cyan">payment.paid</span>, <span className="text-triq-cyan">payment.failed</span></li>
          <li>Copy the Webhook Secret from the created webhook</li>
          <li>Paste all three values above and click <strong className="text-gray-300">Save Credentials</strong></li>
        </ol>
      </div>
    </div>
  );
}
