/**
 * AIPrompts — страница «AI / Промпты» в админке.
 *
 * Слева табы инструментов, справа — редактор:
 *   - System prompt (с возможностью сбросить к дефолту)
 *   - Дополнительные инструкции
 *   - Кнопка «Тест» — открывает диалог с полями этого инструмента +
 *     даёт превью итогового промпта и ответ AI.
 *
 * Сохранять и сбрасывать может только super_admin.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Tabs, Tab, Alert, CircularProgress,
  Chip, Stack, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Select, MenuItem, FormControl, InputLabel, Divider, Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { aiPromptsApi, type PromptConfig, type PreviewResult } from '../api/aiPrompts';
import { getCurrentUser } from '../auth/auth';

export default function AIPrompts() {
  const user = getCurrentUser();
  const isSuperAdmin = user?.role === 'super_admin';

  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);

  // Локальные значения форм (по toolKey)
  const [drafts, setDrafts] = useState<Record<string, { system: string; extra: string }>>({});

  const [testFor, setTestFor] = useState<PromptConfig | null>(null);

  const reload = () => {
    setLoading(true);
    aiPromptsApi.list()
      .then(list => {
        setPrompts(list);
        // Инициализация драфтов из загруженных значений
        const d: typeof drafts = {};
        for (const p of list) d[p.toolKey] = { system: p.systemPrompt, extra: p.extraInstructions };
        setDrafts(d);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const current = prompts[activeTab];
  const draft = current ? drafts[current.toolKey] || { system: '', extra: '' } : { system: '', extra: '' };
  const isDirty = current && (
    draft.system !== current.systemPrompt || draft.extra !== current.extraInstructions
  );

  const setDraft = (toolKey: string, field: 'system' | 'extra', value: string) => {
    setDrafts(d => ({ ...d, [toolKey]: { ...d[toolKey], [field]: value } }));
  };

  const handleSave = async () => {
    if (!current || !isSuperAdmin) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const updated = await aiPromptsApi.save(current.toolKey, {
        system_prompt: draft.system,
        extra_instructions: draft.extra,
      });
      setPrompts(prev => prev.map(p => p.toolKey === current.toolKey ? updated : p));
      setSuccess('Промпт сохранён');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!current || !isSuperAdmin) return;
    if (!confirm(`Сбросить промпт «${current.label}» к дефолтному значению из кода?`)) return;
    setSaving(true); setError(null);
    try {
      const reset = await aiPromptsApi.reset(current.toolKey);
      setPrompts(prev => prev.map(p => p.toolKey === current.toolKey ? reset : p));
      setDrafts(d => ({ ...d, [current.toolKey]: { system: reset.systemPrompt, extra: reset.extraInstructions } }));
      setSuccess('Сброшено к дефолту');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сбросить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeRoundedIcon sx={{ color: '#C9A84C' }} /> AI-промпты
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Редактируйте system-промпты и дополнительные инструкции для каждого AI-инструмента.
          Изменения применяются сразу для всех агентов.
        </Typography>
      </Box>

      {!isSuperAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Только просмотр. Менять промпты может супер-админ.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
      ) : prompts.length === 0 ? (
        <Alert severity="info">Пока нет инструментов.</Alert>
      ) : (
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Tabs */}
          <Box sx={{ flexShrink: 0, minWidth: { md: 240 } }}>
            <Tabs
              orientation="vertical"
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                borderRight: { md: '1px solid rgba(201,168,76,0.1)' },
                '& .MuiTab-root': { alignItems: 'flex-start', textAlign: 'left', textTransform: 'none', fontSize: 14, fontWeight: 500, color: '#94A3B8', minHeight: 44, py: 1, px: 2 },
                '& .Mui-selected': { color: '#C9A84C !important', fontWeight: 700 },
                '& .MuiTabs-indicator': { background: '#C9A84C', left: 0, right: 'auto', width: 3 },
              }}
            >
              {prompts.map(p => (
                <Tab key={p.toolKey} label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{p.label}</span>
                    {p.isCustomized && <Chip label="изм." size="small" sx={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 700, fontSize: 9, height: 16 }} />}
                  </Box>
                } />
              ))}
            </Tabs>
          </Box>

          {/* Editor */}
          {current && (
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <motion.div key={current.toolKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
                        {current.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        {current.isCustomized
                          ? `Изменено ${current.updatedAt ? new Date(current.updatedAt.replace(' ', 'T') + 'Z').toLocaleString('ru-RU') : ''}`
                          : 'Используется дефолт из кода'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1.5 }}>
                      Ключ инструмента: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 3 }}>{current.toolKey}</code>
                    </Typography>
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        System prompt
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569' }}>
                        задаёт «характер» модели — кем она себя представляет
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth multiline rows={10}
                      value={draft.system}
                      onChange={e => setDraft(current.toolKey, 'system', e.target.value)}
                      disabled={!isSuperAdmin || saving}
                      slotProps={{ input: { sx: { fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.55 } } }}
                    />
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Дополнительные инструкции
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569' }}>
                        дописываются в конец user-промпта (опционально)
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth multiline rows={5}
                      value={draft.extra}
                      onChange={e => setDraft(current.toolKey, 'extra', e.target.value)}
                      disabled={!isSuperAdmin || saving}
                      placeholder="Например: «Используй больше эмодзи. В конце добавляй ссылку https://welcome24.ru»"
                      slotProps={{ input: { sx: { fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.55 } } }}
                    />
                  </Box>

                  <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />

                  <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                    <Tooltip title={current.isCustomized ? 'Удалить кастомные значения, использовать дефолт из кода' : 'Промпт уже дефолтный'}>
                      <span>
                        <Button startIcon={<RestartAltRoundedIcon />} variant="outlined" color="warning"
                          onClick={handleReset} disabled={!isSuperAdmin || !current.isCustomized || saving}
                        >
                          Сбросить к дефолту
                        </Button>
                      </span>
                    </Tooltip>
                    <Stack direction="row" spacing={1}>
                      {isSuperAdmin && (
                        <Button startIcon={<PlayArrowRoundedIcon />} variant="outlined"
                          onClick={() => setTestFor(current)}
                        >
                          Тест
                        </Button>
                      )}
                      <Button startIcon={<SaveRoundedIcon />} variant="contained"
                        onClick={handleSave} disabled={!isSuperAdmin || !isDirty || saving}
                      >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </motion.div>
            </Box>
          )}
        </Box>
      )}

      {testFor && (
        <TestDialog
          tool={testFor}
          draft={drafts[testFor.toolKey] || { system: '', extra: '' }}
          onClose={() => setTestFor(null)}
        />
      )}
    </Box>
  );
}

// ---------- Test dialog ----------

interface TestProps {
  tool: PromptConfig;
  draft: { system: string; extra: string };
  onClose: () => void;
}

function TestDialog({ tool, draft, onClose }: TestProps) {
  const [input, setInput] = useState<Record<string, string>>(getDefaultInput(tool.toolKey));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'prompt' | 'output'>('output');

  const runPreview = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await aiPromptsApi.preview({
        tool: tool.toolKey,
        input,
        system_prompt: draft.system,
        extra_instructions: draft.extra,
      });
      setResult(r);
      setTab(r.stub ? 'prompt' : 'output');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка теста');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Тест промпта · {tool.label}</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Использует НЕсохранённые значения формы. Лимит не тратится.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 3 }}>
          {/* Input form */}
          <Box>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
              Параметры запроса
            </Typography>
            <Stack spacing={1.5}>
              {renderInputFields(tool.toolKey, input, (k, v) => setInput(prev => ({ ...prev, [k]: v })))}
              <Button variant="contained" onClick={runPreview} disabled={loading} startIcon={<PlayArrowRoundedIcon />}>
                {loading ? 'Генерирую…' : 'Запустить тест'}
              </Button>
            </Stack>
          </Box>

          {/* Result */}
          <Box sx={{ minWidth: 0 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!result && !loading && (
              <Box sx={{ p: 4, textAlign: 'center', color: '#64748B' }}>
                <Typography variant="body2">Заполни параметры и нажми «Запустить тест»</Typography>
              </Box>
            )}

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2, alignItems: 'center' }}>
                <CircularProgress size={28} sx={{ color: '#C9A84C' }} />
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>AI думает…</Typography>
              </Box>
            )}

            {result && (
              <Box>
                {result.stub && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Ответ-заглушка. Чтобы получить реальный ответ модели, добавь
                    <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 3, margin: '0 4px' }}>ANTHROPIC_API_KEY</code>
                    в Render env.
                  </Alert>
                )}
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid rgba(201,168,76,0.1)', mb: 2 }}>
                  <Tab value="output" label="Ответ модели" />
                  <Tab value="prompt" label="Финальные промпты" />
                </Tabs>
                {tab === 'output' && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>
                        Токенов: in {result.tokens.input_tokens} / out {result.tokens.output_tokens}
                      </Typography>
                      <IconButton size="small" onClick={() => copy(result.output)} sx={{ color: '#94A3B8' }}>
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box sx={{
                      p: 2, borderRadius: 2, background: 'rgba(15,22,41,0.6)',
                      border: '1px solid rgba(201,168,76,0.1)',
                      whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: '#F1F5F9',
                      maxHeight: 500, overflowY: 'auto',
                    }}>
                      {result.output}
                    </Box>
                  </Box>
                )}
                {tab === 'prompt' && (
                  <Stack spacing={2}>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>System</Typography>
                        <IconButton size="small" onClick={() => copy(result.system)} sx={{ color: '#94A3B8' }}>
                          <ContentCopyRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(201,168,76,0.1)', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.6, color: '#94A3B8', maxHeight: 200, overflowY: 'auto' }}>
                        {result.system}
                      </Box>
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>User</Typography>
                        <IconButton size="small" onClick={() => copy(result.userPrompt)} sx={{ color: '#94A3B8' }}>
                          <ContentCopyRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(201,168,76,0.1)', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.6, color: '#94A3B8', maxHeight: 400, overflowY: 'auto' }}>
                        {result.userPrompt}
                      </Box>
                    </Box>
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

// Дефолтные значения для теста по типу инструмента.
function getDefaultInput(toolKey: string): Record<string, string> {
  if (toolKey === 'listing') {
    return {
      propertyType: 'квартира', rooms: '2', area: '65',
      floor: '5', totalFloors: '9',
      district: 'Центр', price: '12 500 000 ₽',
      condition: 'евроремонт 2024',
      features: 'видовой балкон, парковка, рядом школа и парк',
      format: 'avito', tone: 'selling',
    };
  }
  if (toolKey === 'social_post') {
    return {
      topic: 'new_listing',
      platform: 'instagram',
      tone: 'friendly',
      content: 'Продаётся 2-комнатная в новом ЖК «Парус», 70 м², видовая. Идеально для семьи с детьми — рядом парк и две школы.',
    };
  }
  return {};
}

// Рендерит поля для каждого инструмента (используются те же ключи что в /api/ai/generate).
function renderInputFields(
  toolKey: string,
  input: Record<string, string>,
  set: (k: string, v: string) => void,
) {
  if (toolKey === 'listing') {
    return (
      <>
        <FormControl size="small">
          <InputLabel>Тип</InputLabel>
          <Select value={input.propertyType || ''} label="Тип" onChange={e => set('propertyType', e.target.value)}>
            <MenuItem value="квартира">Квартира</MenuItem>
            <MenuItem value="дом">Дом</MenuItem>
            <MenuItem value="апартаменты">Апартаменты</MenuItem>
            <MenuItem value="таунхаус">Таунхаус</MenuItem>
            <MenuItem value="коммерческая">Коммерческая</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Комнат" value={input.rooms || ''} onChange={e => set('rooms', e.target.value)} />
        <TextField size="small" label="Площадь, м²" value={input.area || ''} onChange={e => set('area', e.target.value)} />
        <TextField size="small" label="Этаж" value={input.floor || ''} onChange={e => set('floor', e.target.value)} />
        <TextField size="small" label="Этажей всего" value={input.totalFloors || ''} onChange={e => set('totalFloors', e.target.value)} />
        <TextField size="small" label="Район" value={input.district || ''} onChange={e => set('district', e.target.value)} />
        <TextField size="small" label="Цена" value={input.price || ''} onChange={e => set('price', e.target.value)} />
        <TextField size="small" label="Состояние" value={input.condition || ''} onChange={e => set('condition', e.target.value)} />
        <TextField size="small" label="Особенности" multiline rows={2} value={input.features || ''} onChange={e => set('features', e.target.value)} />
        <FormControl size="small">
          <InputLabel>Площадка</InputLabel>
          <Select value={input.format || ''} label="Площадка" onChange={e => set('format', e.target.value)}>
            <MenuItem value="avito">Avito</MenuItem>
            <MenuItem value="cian">ЦИАН</MenuItem>
            <MenuItem value="telegram">Telegram</MenuItem>
            <MenuItem value="instagram">Instagram</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Тон</InputLabel>
          <Select value={input.tone || ''} label="Тон" onChange={e => set('tone', e.target.value)}>
            <MenuItem value="selling">Продающий</MenuItem>
            <MenuItem value="expert">Экспертный</MenuItem>
            <MenuItem value="emotional">Эмоциональный</MenuItem>
          </Select>
        </FormControl>
      </>
    );
  }
  if (toolKey === 'social_post') {
    return (
      <>
        <FormControl size="small">
          <InputLabel>Тема</InputLabel>
          <Select value={input.topic || ''} label="Тема" onChange={e => set('topic', e.target.value)}>
            <MenuItem value="new_listing">Новый объект</MenuItem>
            <MenuItem value="promo">Акция</MenuItem>
            <MenuItem value="advice">Совет</MenuItem>
            <MenuItem value="review">Отзыв клиента</MenuItem>
            <MenuItem value="market">Новость рынка</MenuItem>
            <MenuItem value="personal">Личный пост</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Платформа</InputLabel>
          <Select value={input.platform || ''} label="Платформа" onChange={e => set('platform', e.target.value)}>
            <MenuItem value="instagram">Instagram</MenuItem>
            <MenuItem value="telegram">Telegram</MenuItem>
            <MenuItem value="vk">VK</MenuItem>
            <MenuItem value="threads">Threads</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Тон</InputLabel>
          <Select value={input.tone || ''} label="Тон" onChange={e => set('tone', e.target.value)}>
            <MenuItem value="friendly">Дружелюбный</MenuItem>
            <MenuItem value="professional">Профессиональный</MenuItem>
            <MenuItem value="humorous">С юмором</MenuItem>
            <MenuItem value="motivational">Мотивирующий</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="О чём пост" multiline rows={4} value={input.content || ''} onChange={e => set('content', e.target.value)} />
      </>
    );
  }
  return <Typography variant="caption" sx={{ color: '#64748B' }}>Нет полей для тестирования.</Typography>;
}

// Unused but kept for future cross-reference
void useMemo;
