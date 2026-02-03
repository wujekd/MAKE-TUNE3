import { useEffect, useState } from 'react';
import { SettingsService } from '../services';
import type { SystemSettings } from '../types/collaboration';
import { useAppStore } from '../stores/appStore';
import { AdminNav } from '../components/AdminNav';

export function AdminSettingsView() {
  const { user: adminUser } = useAppStore(state => state.auth);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SettingsService.getSystemSettingsWithDefaults();
      setSettings(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !adminUser) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { updatedAt, updatedBy, ...updates } = settings;
      await SettingsService.updateSystemSettings(updates, adminUser.uid);
      setSuccessMsg('Settings saved successfully');
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSuccessMsg(null);
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div style={{
        padding: 24,
        background: 'var(--primary1-800)',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--white)'
      }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{
      padding: 24,
      background: 'var(--primary1-800)',
      height: '100%',
      minHeight: 0,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        flex: 1,
        minHeight: 0
      }}      >
        <AdminNav />
        <h2 style={{ color: 'var(--white)', margin: 0 }}>Global Settings</h2>

        {error && (
          <div style={{
            color: '#ff6b6b',
            background: 'rgba(255,107,107,0.15)',
            padding: 12,
            borderRadius: 6
          }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            color: '#4CAF50',
            background: 'rgba(76,175,80,0.15)',
            padding: 12,
            borderRadius: 6
          }}>
            {successMsg}
          </div>
        )}

        {settings && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: 8
          }}>
            <div style={{
              background: 'var(--primary1-700)',
              borderRadius: 12,
              padding: 16
            }}>
              <h3 style={{ color: 'var(--white)', margin: '0 0 16px 0', fontSize: 16 }}>
                Feature Toggles
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ToggleRow
                  label="Project Creation"
                  description="Allow users to create new projects"
                  checked={settings.projectCreationEnabled}
                  onChange={v => updateSetting('projectCreationEnabled', v)}
                />
                <ToggleRow
                  label="Submissions"
                  description="Allow users to submit to collaborations"
                  checked={settings.submissionsEnabled}
                  onChange={v => updateSetting('submissionsEnabled', v)}
                />
                <ToggleRow
                  label="Voting"
                  description="Allow users to vote on submissions"
                  checked={settings.votingEnabled}
                  onChange={v => updateSetting('votingEnabled', v)}
                />
              </div>
            </div>

            <div style={{
              background: 'var(--primary1-700)',
              borderRadius: 12,
              padding: 16
            }}>
              <h3 style={{ color: 'var(--white)', margin: '0 0 16px 0', fontSize: 16 }}>
                Limits
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <NumberInput
                  label="Default Project Allowance"
                  description="Base number of projects all users can create (added to tier limits)"
                  value={settings.defaultProjectAllowance}
                  onChange={v => updateSetting('defaultProjectAllowance', v)}
                  min={0}
                  max={100}
                />
                <NumberInput
                  label="Max Submissions Per Collaboration"
                  description="Maximum number of submissions allowed per collaboration"
                  value={settings.maxSubmissionsPerCollab}
                  onChange={v => updateSetting('maxSubmissionsPerCollab', v)}
                  min={1}
                  max={1000}
                />
              </div>
            </div>

            <div style={{
              background: 'var(--primary1-700)',
              borderRadius: 12,
              padding: 16
            }}>
              <h3 style={{ color: 'var(--white)', margin: '0 0 12px 0', fontSize: 16 }}>
                Last Updated
              </h3>
              <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 14 }}>
                {formatDate(settings.updatedAt)} by {settings.updatedBy || 'unknown'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  fontSize: 15,
                  fontWeight: 600
                }}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={loadSettings}
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  fontSize: 15,
                  background: 'var(--primary1-600)'
                }}
              >
                Reload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string; 
  description: string; 
  checked: boolean; 
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--primary1-600)'
    }}>
      <div>
        <div style={{ color: 'var(--white)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 13 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          padding: '6px 16px',
          background: checked ? '#4CAF50' : 'var(--primary1-500)',
          border: 'none',
          borderRadius: 4,
          color: 'white',
          cursor: 'pointer',
          minWidth: 80
        }}
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

function NumberInput({
  label,
  description,
  value,
  onChange,
  min,
  max
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--white)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 13 }}>{description}</div>
      </div>
      <input
        type="number"
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) {
            onChange(v);
          }
        }}
        min={min}
        max={max}
        style={{
          width: 100,
          padding: 8,
          background: 'var(--primary1-800)',
          border: '1px solid var(--primary1-500)',
          borderRadius: 4,
          color: 'var(--white)',
          fontSize: 14,
          textAlign: 'center'
        }}
      />
    </div>
  );
}
