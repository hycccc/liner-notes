'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ChevronDown, ChevronUp, Plus, Trash2, Save, LogOut,
  Music, FileText, Eye, X, Rocket, Home, Briefcase, Moon, Sun,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

type TrackStatus = 'Idea' | 'Demo' | 'Recording' | 'Mixing' | 'Done';
interface Track { number: string; title: string; status: TrackStatus; currentlyWorking: boolean; demo: string; story: string; lyrics: string; notes: string; tags: string[]; }
interface AlbumData { title: string; artist: string; year: string; concept: string; tracks: Track[]; }
interface Post { slug: string; title: string; date: string; tags: string[]; excerpt: string; content: string; }
interface TimelineItem { period: string; title: string; subtitle: string; type: 'work' | 'edu'; }
interface HomeData { tagline: string; about: string; timeline: TimelineItem[]; }
interface ProjectItem { title: string; description: string; status: string; tags: string[]; url: string; icon: string; }

// ── Theme helpers ──────────────────────────────────────────────────────

function cls(isDark: boolean) {
  return {
    page:    isDark ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900',
    topbar:  isDark ? 'bg-zinc-950/95 border-zinc-800' : 'bg-white/95 border-zinc-200',
    savebar: isDark ? 'bg-zinc-950/95 border-zinc-800' : 'bg-zinc-100/95 border-zinc-200',
    card:    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200',
    card2:   isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200',
    inp:     isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500/50' : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500/60',
    inp2:    isDark ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-amber-500/50' : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500/60',
    label:   isDark ? 'text-zinc-500' : 'text-zinc-500',
    section: isDark ? 'text-zinc-300' : 'text-zinc-700',
    muted:   isDark ? 'text-zinc-500' : 'text-zinc-400',
    tabOn:   isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900',
    tabOff:  isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800',
    row:     isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300',
  };
}

const STATUS_COLORS: Record<TrackStatus, string> = {
  Done: 'bg-emerald-500/20 text-emerald-400', Demo: 'bg-blue-500/20 text-blue-400',
  Recording: 'bg-purple-500/20 text-purple-400', Mixing: 'bg-orange-500/20 text-orange-400',
  Idea: 'bg-zinc-700 text-zinc-400',
};

function renderMd(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-zinc-700 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-5 mb-3">$1</h1>')
    .replace(/\n\n/g, '</p><p class="mt-3">').replace(/\n/g, '<br/>');
}

function authHeaders(t: string) { return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }; }

// ── Shared components ──────────────────────────────────────────────────────

function Field({ label, c, children }: { label: string; c: ReturnType<typeof cls>; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={`text-xs font-medium block ${c.label}`}>{label}</label>
      {children}
    </div>
  );
}

function SaveBar({ onSave, saving, saved, c, extra }: {
  onSave: () => void; saving: boolean; saved: boolean; c: ReturnType<typeof cls>; extra?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 py-3 border-b mb-6 sticky top-[57px] backdrop-blur-sm z-10 ${c.savebar}`}>
      {extra}
      <div className="flex-1" />
      {saved && <span className="text-emerald-500 text-xs">Saved ✓</span>}
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

// ── Login page ────────────────────────────────────────────────────────

function LoginPage({ onLogin, isDark }: { onLogin: (t: string) => void; isDark: boolean }) {
  const c = cls(isDark);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const d = await r.json();
      if (d.ok) onLogin(d.token); else setErr('Wrong password');
    } catch { setErr('Connection failed'); } finally { setLoading(false); }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${c.page}`}>
      <form onSubmit={submit} className={`border rounded-2xl p-8 w-full max-w-sm space-y-4 shadow-xl ${c.card}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-400 text-lg">✦</span>
          <h1 className="text-lg font-bold">Studio Admin</h1>
        </div>
        {/* font-size must be >= 16px, otherwise iOS auto-zooms the input */}
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Admin password" autoFocus
          style={{ fontSize: '16px' }}
          className={`w-full border rounded-lg px-3 py-2.5 outline-none transition-colors ${c.inp}`} />
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
          {loading ? 'Verifying...' : 'Enter'}
        </button>
      </form>
    </div>
  );
}

// ── Home editor ──────────────────────────────────────────────────────

function HomeEditor({ token, isDark }: { token: string; isDark: boolean }) {
  const c = cls(isDark);
  const [data, setData] = useState<HomeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/home', { headers: authHeaders(token) }).then(r => r.json()).then(d => !d.error && setData(d));
  }, [token]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    await fetch('/api/admin/home', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const updTl = (i: number, k: keyof TimelineItem, v: string) => {
    if (!data) return;
    const tl = [...data.timeline]; tl[i] = { ...tl[i], [k]: v }; setData({ ...data, timeline: tl });
  };

  if (!data) return <div className={`py-10 text-center text-sm ${c.muted}`}>Loading...</div>;

  return (
    <div>
      <SaveBar onSave={save} saving={saving} saved={saved} c={c} />
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className={`text-sm font-semibold ${c.section}`}>Basics</h3>
          <Field label="Tagline" c={c}>
            <input value={data.tagline} onChange={e => setData({ ...data, tagline: e.target.value })}
              placeholder="Your Name · what you do · where"
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${c.inp}`} />
          </Field>
          <Field label="About" c={c}>
            <textarea value={data.about} onChange={e => setData({ ...data, about: e.target.value })} rows={3}
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none transition-colors ${c.inp}`} />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-semibold ${c.section}`}>Timeline</h3>
            <button onClick={() => setData({ ...data, timeline: [...data.timeline, { period: '', title: '', subtitle: '', type: 'work' }] })}
              className={`flex items-center gap-1 text-xs transition-colors ${c.muted} hover:text-amber-500`}>
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          {data.timeline.map((item, i) => (
            <div key={i} className={`border rounded-xl p-4 space-y-3 ${c.card}`}>
              <div className="flex items-center gap-2 justify-between">
                <select value={item.type} onChange={e => updTl(i, 'type', e.target.value)}
                  className={`border rounded-lg px-2 py-1 text-xs outline-none ${c.inp2}`}>
                  <option value="work">💼 Work</option>
                  <option value="edu">🎓 Education</option>
                </select>
                <button onClick={() => setData({ ...data, timeline: data.timeline.filter((_, j) => j !== i) })}
                  className="text-red-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['period', 'title', 'subtitle'] as const).map(k => (
                  <Field key={k} label={k === 'period' ? 'Period' : k === 'title' ? 'Company/School' : 'Role/Major'} c={c}>
                    <input value={item[k]} onChange={e => updTl(i, k, e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-sm outline-none transition-colors ${c.inp2}`} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Projects editor ──────────────────────────────────────────────────────

function ProjectsEditor({ token, isDark }: { token: string; isDark: boolean }) {
  const c = cls(isDark);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/admin/projects', { headers: authHeaders(token) }).then(r => r.json()).then(d => Array.isArray(d) && setItems(d));
  }, [token]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/admin/projects', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(items) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const upd = (i: number, k: keyof ProjectItem, v: string | string[]) => {
    const a = [...items]; a[i] = { ...a[i], [k]: v }; setItems(a);
  };

  return (
    <div>
      <SaveBar onSave={save} saving={saving} saved={saved} c={c} extra={
        <button onClick={() => { setItems([...items, { title: '', description: '', status: 'WIP', tags: [], url: '', icon: '🔧' }]); setOpen(items.length); }}
          className={`flex items-center gap-1.5 text-sm transition-colors ${c.muted} hover:text-amber-500`}>
          <Plus className="w-4 h-4" /> Add project
        </button>
      } />
      <div className="space-y-2">
        {items.length === 0 && <div className={`text-center py-10 text-sm ${c.muted}`}>No projects yet</div>}
        {items.map((p, i) => (
          <div key={i} className={`border rounded-xl overflow-hidden ${c.row}`}>
            <div onClick={() => setOpen(open === i ? null : i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors`}>
              <span className="text-xl">{p.icon || '📦'}</span>
              <span className="text-sm font-medium flex-1">{p.title || '(untitled)'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                p.status === 'LIVE' ? 'bg-teal-500/20 text-teal-400' : p.status === 'WIP' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'
              }`}>{p.status}</span>
              {open === i ? <ChevronUp className={`w-4 h-4 ${c.muted}`} /> : <ChevronDown className={`w-4 h-4 ${c.muted}`} />}
            </div>
            {open === i && (
              <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Project name" c={c}><input value={p.title} onChange={e => upd(i, 'title', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Field label="Icon" c={c}><input value={p.icon} onChange={e => upd(i, 'icon', e.target.value)} placeholder="Globe / Code / Music / 🔧" className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`} /></Field>
                      <p className={`text-[11px] ${c.muted}`}>Lucide names: Globe Code Music Star Zap Mail Sparkles Briefcase — or any emoji</p>
                    </div>
                    <Field label="Status" c={c}>
                      <select value={p.status} onChange={e => upd(i, 'status', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`}>
                        <option>LIVE</option><option>WIP</option><option>ARCHIVED</option>
                      </select>
                    </Field>
                  </div>
                </div>
                <Field label="Description" c={c}><textarea value={p.description} onChange={e => upd(i, 'description', e.target.value)} rows={2} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none ${c.inp2}`} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tags (comma separated)" c={c}><input value={p.tags.join(', ')} onChange={e => upd(i, 'tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`} /></Field>
                  <Field label="URL" c={c}><input value={p.url} onChange={e => upd(i, 'url', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`} /></Field>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { if (!confirm('Delete this project?')) return; setItems(items.filter((_, j) => j !== i)); setOpen(null); }}
                    className="text-red-400 hover:text-red-500 text-xs flex items-center gap-1.5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete project
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Album editor ──────────────────────────────────────────────────────

function AlbumEditor({ token, isDark }: { token: string; isDark: boolean }) {
  const c = cls(isDark);
  const [data, setData] = useState<AlbumData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/admin/album', { headers: authHeaders(token) }).then(r => r.json()).then(d => !d.error && setData(d));
  }, [token]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    await fetch('/api/admin/album', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const updTrack = (i: number, k: keyof Track, v: string | boolean) => {
    if (!data) return;
    const tr = [...data.tracks]; tr[i] = { ...tr[i], [k]: v }; setData({ ...data, tracks: tr });
  };

  if (!data) return <div className={`py-10 text-center text-sm ${c.muted}`}>Loading...</div>;

  return (
    <div>
      <SaveBar onSave={save} saving={saving} saved={saved} c={c} extra={
        <button onClick={() => { if (!data) return; const n = String(data.tracks.length + 1).padStart(2, '0'); setData({ ...data, tracks: [...data.tracks, { number: n, title: '', status: 'Idea', currentlyWorking: false, demo: '', story: '', lyrics: '', notes: '', tags: [] }] }); setOpen(data.tracks.length); }}
          className={`flex items-center gap-1.5 text-sm transition-colors ${c.muted} hover:text-amber-500`}>
          <Plus className="w-4 h-4" /> Add track
        </button>
      } />

      <div className="space-y-6">
        <div>
          <h3 className={`text-sm font-semibold mb-3 ${c.section}`}>Album concept</h3>
          <textarea value={data.concept} onChange={e => setData({ ...data, concept: e.target.value })}
            rows={5} placeholder="Album concept (blank line between paragraphs)"
            className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none leading-relaxed transition-colors ${c.inp}`} />
        </div>

        <div>
          <h3 className={`text-sm font-semibold mb-3 ${c.section}`}>Tracks ({data.tracks.length})</h3>
          <div className="space-y-2">
            {data.tracks.map((t, i) => (
              <div key={i} className={`border rounded-xl overflow-hidden ${c.row}`}>
                <div onClick={() => setOpen(open === i ? null : i)} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <span className={`text-xs font-mono w-5 ${c.muted}`}>{t.number}</span>
                  <span className="text-sm font-medium flex-1 truncate">{t.title || '(untitled)'}</span>
                  {t.currentlyWorking && <span className="text-amber-400 text-xs hidden sm:block">● WIP</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  {open === i ? <ChevronUp className={`w-4 h-4 ${c.muted}`} /> : <ChevronDown className={`w-4 h-4 ${c.muted}`} />}
                </div>
                {open === i && (
                  <div className={`px-4 pb-5 pt-3 border-t space-y-4 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Title" c={c}><input value={t.title} onChange={e => updTrack(i, 'title', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`} /></Field>
                      <Field label="Status" c={c}>
                        <select value={t.status} onChange={e => updTrack(i, 'status', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`}>
                          {(['Idea','Demo','Recording','Mixing','Done'] as TrackStatus[]).map(s => <option key={s}>{s}</option>)}
                        </select>
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={t.currentlyWorking} onChange={e => updTrack(i, 'currentlyWorking', e.target.checked)} className="accent-amber-500 w-4 h-4" />
                      <span className={`text-sm ${c.muted}`}>● Working (in progress)</span>
                    </label>
                    <Field label="Demo path" c={c}><input value={t.demo} onChange={e => updTrack(i, 'demo', e.target.value)} placeholder="/demos/xxx.mp3" className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp2}`} /></Field>
                    <Field label="Story" c={c}><textarea value={t.story} onChange={e => updTrack(i, 'story', e.target.value)} rows={4} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none leading-relaxed ${c.inp2}`} /></Field>
                    <Field label="Lyrics (blank line between paragraphs)" c={c}><textarea value={t.lyrics} onChange={e => updTrack(i, 'lyrics', e.target.value)} rows={6} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none font-mono leading-relaxed ${c.inp2}`} /></Field>
                    <Field label="Production notes" c={c}><textarea value={t.notes} onChange={e => updTrack(i, 'notes', e.target.value)} rows={2} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none ${c.inp2}`} /></Field>
                    <div className="flex justify-end">
                      <button onClick={() => { if (!data || !confirm('Delete this track?')) return; setData({ ...data, tracks: data.tracks.filter((_, j) => j !== i) }); setOpen(null); }}
                        className="text-red-400 hover:text-red-500 text-xs flex items-center gap-1.5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete track
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Blog editor ──────────────────────────────────────────────────────

function BlogEditor({ token, isDark }: { token: string; isDark: boolean }) {
  const c = cls(isDark);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [view, setView] = useState<'edit' | 'preview' | 'split'>('edit');

  const load = useCallback(() => {
    fetch('/api/admin/posts', { headers: authHeaders(token) }).then(r => r.json()).then(d => Array.isArray(d) && setPosts(d));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const savePost = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(isNew ? '/api/admin/posts' : `/api/admin/posts/${editing.slug}`, {
      method: isNew ? 'POST' : 'PUT', headers: authHeaders(token), body: JSON.stringify(editing),
    });
    setSaving(false); setSaved(true); setTimeout(() => { setSaved(false); load(); }, 1500);
  };

  if (editing) return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 py-3 border-b sticky top-[57px] backdrop-blur-sm z-10 ${c.savebar}`}>
        <button onClick={() => setEditing(null)} className={`p-1 transition-colors ${c.muted} hover:text-amber-500`}><X className="w-4 h-4" /></button>
        <span className="text-sm font-medium flex-1 truncate">{isNew ? 'New post' : editing.slug}</span>
        <div className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
          {(['edit', 'split', 'preview'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === v ? (isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-900') : c.muted}`}>
              {v === 'edit' ? 'Edit' : v === 'split' ? 'Split' : 'Preview'}
            </button>
          ))}
        </div>
        {!isNew && <a href={`/blog/${editing.slug}`} target="_blank" className={`p-1 transition-colors ${c.muted} hover:text-amber-500`}><Eye className="w-4 h-4" /></a>}
        {saved ? <span className="text-emerald-500 text-xs">Saved ✓</span>
          : <button onClick={savePost} disabled={saving}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />{saving ? '...' : 'Save'}
            </button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isNew && <div className="col-span-2"><Field label="slug (lowercase)" c={c}><input value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="my-post" className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp}`} /></Field></div>}
        <Field label="Title" c={c}><input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp}`} /></Field>
        <Field label="Date" c={c}><input type="date" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp}`} /></Field>
        <Field label="Tags (comma separated)" c={c}><input value={editing.tags.join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp}`} /></Field>
        <Field label="Excerpt" c={c}><input value={editing.excerpt} onChange={e => setEditing({ ...editing, excerpt: e.target.value })} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${c.inp}`} /></Field>
      </div>

      {view === 'split' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Markdown" c={c}><textarea value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={28} className={`w-full border rounded-lg px-3 py-3 text-sm outline-none resize-none font-mono leading-relaxed ${c.inp}`} /></Field>
          <Field label="Preview" c={c}>
            <div className={`w-full border rounded-lg px-4 py-3 text-sm leading-relaxed overflow-auto ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-600'}`}
              style={{ minHeight: '28rem' }} dangerouslySetInnerHTML={{ __html: `<p>${renderMd(editing.content)}</p>` }} />
          </Field>
        </div>
      ) : view === 'preview' ? (
        <Field label="Preview" c={c}>
          <div className={`w-full border rounded-lg px-4 py-3 text-sm leading-relaxed ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-600'}`}
            style={{ minHeight: '20rem' }} dangerouslySetInnerHTML={{ __html: `<p>${renderMd(editing.content)}</p>` }} />
        </Field>
      ) : (
        <Field label="Body (Markdown)" c={c}>
          <textarea value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={24} placeholder="Write Markdown here..."
            className={`w-full border rounded-lg px-3 py-3 text-sm outline-none resize-none font-mono leading-relaxed ${c.inp}`} />
        </Field>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between py-3 border-b sticky top-[57px] backdrop-blur-sm z-10 ${c.savebar}`}>
        <span className={`text-sm ${c.muted}`}>{posts.length} posts</span>
        <button onClick={() => { setEditing({ slug: '', title: '', date: new Date().toISOString().slice(0, 10), tags: [], excerpt: '', content: '' }); setIsNew(true); setView('edit'); }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>
      {posts.length === 0 && <div className={`text-center py-10 text-sm ${c.muted}`}>No posts yet</div>}
      <div className="space-y-1.5">
        {posts.map(post => (
          <div key={post.slug} className={`flex items-center gap-3 border rounded-xl px-4 py-3 transition-colors ${c.row}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{post.title}</p>
              <p className={`text-xs mt-0.5 ${c.muted}`}>{post.date} · {post.slug}</p>
            </div>
            <a href={`/blog/${post.slug}`} target="_blank" className={`p-1.5 transition-colors ${c.muted} hover:text-amber-500`}><Eye className="w-4 h-4" /></a>
            <button onClick={async () => { const r = await fetch(`/api/admin/posts/${post.slug}`, { headers: authHeaders(token) }); setEditing(await r.json()); setIsNew(false); setView('edit'); }}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${c.muted} hover:text-amber-500`}>Edit</button>
            <button onClick={async () => { if (!confirm(`Delete "${post.slug}"?`)) return; setDeleting(post.slug); await fetch(`/api/admin/posts/${post.slug}`, { method: 'DELETE', headers: authHeaders(token) }); setDeleting(null); load(); }}
              disabled={deleting === post.slug} className={`p-1.5 transition-colors ${c.muted} hover:text-red-400 disabled:opacity-40`}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────

type Tab = 'home' | 'projects' | 'album' | 'blog';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
  { id: 'projects', label: 'Projects', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'album', label: 'Album', icon: <Music className="w-4 h-4" /> },
  { id: 'blog', label: 'Blog', icon: <FileText className="w-4 h-4" /> },
];

export default function AdminPage() {
  const router = useRouter();
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = !mounted || theme === 'dark';
  const c = cls(isDark);

  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  useEffect(() => {
    try { const t = localStorage.getItem('admin-token'); if (t) setToken(t); } catch {}
  }, []);

  const login = (t: string) => { try { localStorage.setItem('admin-token', t); } catch {} setToken(t); };

  // Logout: clear the token and force a full-page navigation (avoids Next.js soft navigation inheriting scroll position)
  const logout = () => {
    try { localStorage.removeItem('admin-token'); } catch {}
    window.location.href = '/';
  };

  const publish = async () => {
    if (!token || !confirm('Publish? The site will rebuild and go live in about 60 seconds.')) return;
    setPublishing(true); setPublishMsg('');
    try {
      const r = await fetch('/api/admin/publish', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setPublishMsg(d.message || 'Published');
    } catch { setPublishMsg('Publish failed'); }
    finally { setPublishing(false); setTimeout(() => setPublishMsg(''), 6000); }
  };

  if (!token) return <LoginPage onLogin={login} isDark={isDark} />;

  return (
    <div className={`min-h-screen ${c.page}`}>
      {/* Top bar */}
      <div className={`border-b h-[57px] px-4 flex items-center gap-2 sticky top-0 backdrop-blur-sm z-20 ${c.topbar}`}>
        <span className="text-amber-400 font-bold text-sm mr-1">✦</span>
        <div className="flex items-center gap-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? c.tabOn : c.tabOff}`}>
              {t.icon}
              <span className="hidden sm:block">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {publishMsg && <span className="text-emerald-500 text-xs hidden sm:block">{publishMsg}</span>}
        <button onClick={publish} disabled={publishing}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Rocket className="w-3.5 h-3.5" />
          <span className="hidden sm:block">{publishing ? 'Building...' : 'Publish'}</span>
        </button>
        {/* Theme toggle */}
        <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-colors ${c.tabOff}`} title="Toggle theme">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {/* Log out to the main site */}
        <button onClick={logout} className={`p-1.5 rounded-lg transition-colors ${c.tabOff}`} title="Back to home">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {tab === 'home'     && <HomeEditor     token={token} isDark={isDark} />}
        {tab === 'projects' && <ProjectsEditor token={token} isDark={isDark} />}
        {tab === 'album'    && <AlbumEditor    token={token} isDark={isDark} />}
        {tab === 'blog'     && <BlogEditor     token={token} isDark={isDark} />}
      </div>
    </div>
  );
}
