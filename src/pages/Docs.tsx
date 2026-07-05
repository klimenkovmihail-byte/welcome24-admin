/**
 * Docs — база знаний (как Yandex Disk).
 *
 * Двухпанельный лейаут:
 *   Слева: дерево папок (только корневой уровень + быстрый переход).
 *   Справа: содержимое текущей папки (grid с иконками файлов и подпапок).
 *
 * Сверху: breadcrumbs + поиск + кнопки «Новая папка» / «Загрузить файл».
 * Управление: super_admin + admin + manager.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, InputAdornment, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Alert,
  CircularProgress, Tooltip, Menu, MenuItem, Divider, LinearProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import { docsApi, type DocItem, type Breadcrumb } from '../api/docs';
import { getToken, API_BASE_URL, ApiError } from '../api/apiClient';
import ConfirmDialog from '../components/ConfirmDialog';

// Иконка по mime/имени
function fileIcon(item: DocItem) {
  const m = (item.mimeType || '').toLowerCase();
  const n = item.name.toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return { Icon: PictureAsPdfRoundedIcon, color: '#EF4444' };
  if (m.includes('image') || /\.(png|jpg|jpeg|webp|gif|svg)$/.test(n)) return { Icon: ImageRoundedIcon, color: '#06B6D4' };
  if (m.includes('word') || /\.(docx?|odt|rtf)$/.test(n)) return { Icon: DescriptionRoundedIcon, color: '#3B82F6' };
  if (m.includes('sheet') || m.includes('excel') || /\.(xlsx?|ods|csv)$/.test(n)) return { Icon: TableChartRoundedIcon, color: '#22C55E' };
  if (m.includes('video') || /\.(mp4|mov|webm|avi)$/.test(n)) return { Icon: MovieRoundedIcon, color: '#A855F7' };
  return { Icon: InsertDriveFileRoundedIcon, color: '#94A3B8' };
}

const fmtSize = (n: number) => {
  if (!n) return '';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
};

export default function Docs() {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [items, setItems] = useState<DocItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [rootFolders, setRootFolders] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Прогресс пакетной загрузки: {done, total}. null — загрузки нет либо файл один.
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Поиск
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<DocItem[] | null>(null);
  // Путь к родительской папке результата поиска: parentId → «Папка / Подпапка».
  // Резолвим через breadcrumbs (в результатах поиска есть только parentId, но не имя).
  const [folderPaths, setFolderPaths] = useState<Record<number, string>>({});

  // Диалоги
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFor, setRenameFor] = useState<DocItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteFor, setDeleteFor] = useState<DocItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; item: DocItem } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reloadCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const [list, crumbs, roots] = await Promise.all([
        docsApi.list(currentFolderId),
        currentFolderId ? docsApi.breadcrumbs(currentFolderId) : Promise.resolve([] as Breadcrumb[]),
        docsApi.list(null),
      ]);
      setItems(list);
      setBreadcrumbs(crumbs);
      setRootFolders(roots.filter(r => r.type === 'folder'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => { reloadCurrent(); }, [reloadCurrent]);

  // Поиск с дебаунсом
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults(null); return; }
    const h = setTimeout(() => {
      docsApi.search(search.trim()).then(setSearchResults).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  // Подтягиваем путь к папке для результатов поиска (по уникальным parentId, один раз на папку).
  useEffect(() => {
    if (!searchResults) return;
    let cancelled = false;
    const need = Array.from(new Set(
      searchResults.map(r => r.parentId).filter((id): id is number => id != null && folderPaths[id] === undefined),
    ));
    if (need.length === 0) return;
    (async () => {
      const entries = await Promise.all(need.map(async id => {
        try {
          const crumbs = await docsApi.breadcrumbs(id);
          return [id, crumbs.map(c => c.name).join(' / ')] as const;
        } catch {
          return [id, ''] as const;
        }
      }));
      if (cancelled) return;
      setFolderPaths(prev => {
        const next = { ...prev };
        for (const [id, path] of entries) next[id] = path;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [searchResults, folderPaths]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await docsApi.createFolder(currentFolderId, newFolderName.trim());
      setNewFolderOpen(false);
      setNewFolderName('');
      reloadCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать папку');
    }
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setError(null);
    const MAX_MB = 50;

    // Крупные файлы отсеиваем до загрузки — грузим только уложившиеся в лимит.
    const tooBig = files.filter(f => f.size / (1024 * 1024) > MAX_MB);
    const toUpload = files.filter(f => f.size / (1024 * 1024) <= MAX_MB);
    const errors: string[] = tooBig.map(f => `«${f.name}» — ${(f.size / (1024 * 1024)).toFixed(1)} МБ, лимит ${MAX_MB} МБ`);

    if (toUpload.length === 0) {
      setError(`Файлы больше лимита не загружены: ${errors.join('; ')}. Сожмите PDF (например через ilovepdf.com) или разбейте на части.`);
      return;
    }

    setUploading(true);
    // Счётчик «N из M» показываем только при пакетной загрузке (>1 файла).
    setUploadProgress(toUpload.length > 1 ? { done: 0, total: toUpload.length } : null);
    let networkFailed = false;
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        try {
          // ПРИВАТНАЯ загрузка в приватный бакет welcome24-docs (152-ФЗ) — по одному запросу на файл.
          await docsApi.uploadFile(currentFolderId, file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Не удалось загрузить файл';
          if (/failed to fetch|network/i.test(msg)) networkFailed = true;
          errors.push(`«${file.name}» — ${msg}`);
        } finally {
          if (toUpload.length > 1) setUploadProgress({ done: i + 1, total: toUpload.length });
        }
      }
      reloadCurrent();
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }

    if (errors.length) {
      // «Failed to fetch» — обычно сеть/тайм-аут на больших файлах.
      const tail = networkFailed
        ? ' Возможные причины: медленный интернет или сервер сейчас перезапускается. Попробуйте через минуту.'
        : '';
      setError(`Не удалось загрузить: ${errors.join('; ')}.${tail}`);
    }
  };

  const handleRename = async () => {
    if (!renameFor || !renameValue.trim()) return;
    try {
      await docsApi.rename(renameFor.id, renameValue.trim());
      setRenameFor(null); setRenameValue('');
      reloadCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переименовать');
    }
  };

  const confirmDelete = async () => {
    if (!deleteFor) return;
    setDeleting(true);
    try {
      await docsApi.remove(deleteFor.id);
      setDeleteFor(null);
      reloadCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
    } finally {
      setDeleting(false);
    }
  };

  const openItem = async (item: DocItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
      setSearch(''); setSearchResults(null);
      return;
    }
    // Приватный файл (fileUrl пустой) — берём presigned-ссылку; legacy-публичный — открываем напрямую.
    // Safari на iPhone блокирует window.open ПОСЛЕ await — открываем окно синхронно, потом подставляем URL.
    if (item.fileUrl) {
      window.open(item.fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.hasFile) {
      const w = window.open('', '_blank', 'noopener,noreferrer');
      try {
        const { url } = await docsApi.url(item.id);
        if (w) w.location.href = url;
      } catch (e) {
        if (w) w.close();
        setError(e instanceof Error ? e.message : 'Не удалось открыть файл');
      }
    }
  };

  const visibleItems = searchResults !== null ? searchResults : items;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>База документов</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>Документы, регламенты, шаблоны</Typography>
        </Box>
        <TextField
          placeholder="Поиск по документам (от 2 символов)…"
          value={search} onChange={e => setSearch(e.target.value)}
          size="small" sx={{ flex: '0 1 320px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
        />
        <Button startIcon={<CreateNewFolderRoundedIcon />} variant="outlined" onClick={() => setNewFolderOpen(true)}>
          Новая папка
        </Button>
        <Button startIcon={<UploadFileRoundedIcon />} variant="contained" onClick={handleFilePick} disabled={uploading}>
          {uploading
            ? (uploadProgress ? `Загрузка ${uploadProgress.done} из ${uploadProgress.total}…` : 'Загрузка…')
            : 'Загрузить файлы'}
        </Button>
        <input type="file" multiple ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} />
      </Box>

      {uploading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Breadcrumbs */}
      {searchResults === null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
          <IconButton size="small" onClick={() => setCurrentFolderId(null)} sx={{ color: currentFolderId === null ? '#C9A84C' : '#64748B' }}>
            <HomeRoundedIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ color: currentFolderId === null ? '#C9A84C' : '#94A3B8', fontWeight: currentFolderId === null ? 700 : 400, cursor: 'pointer' }}
            onClick={() => setCurrentFolderId(null)}>
            Все документы
          </Typography>
          {breadcrumbs.map((b, i) => (
            <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ChevronRightRoundedIcon sx={{ color: '#475569', fontSize: 16 }} />
              <Typography variant="caption"
                sx={{
                  color: i === breadcrumbs.length - 1 ? '#C9A84C' : '#94A3B8',
                  fontWeight: i === breadcrumbs.length - 1 ? 700 : 400,
                  cursor: i === breadcrumbs.length - 1 ? 'default' : 'pointer',
                }}
                onClick={() => i < breadcrumbs.length - 1 && setCurrentFolderId(b.id)}>
                {b.name}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {searchResults !== null && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`Результаты поиска: ${searchResults.length}`} size="small"
            sx={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE', fontWeight: 700 }} />
          <Button size="small" onClick={() => { setSearch(''); setSearchResults(null); }} sx={{ color: '#94A3B8' }}>
            Сбросить
          </Button>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Sidebar: корневые папки для быстрого перехода */}
        <Box sx={{ flexShrink: 0, width: 240, position: 'sticky', top: 16, display: { xs: 'none', md: 'block' } }}>
          <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', mb: 1, px: 1 }}>
            Категории
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            <Box
              onClick={() => setCurrentFolderId(null)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, cursor: 'pointer',
                background: currentFolderId === null ? 'rgba(201,168,76,0.10)' : 'transparent',
                color: currentFolderId === null ? '#C9A84C' : '#94A3B8',
                '&:hover': { background: 'rgba(201,168,76,0.06)' },
              }}
            >
              <HomeRoundedIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: currentFolderId === null ? 700 : 500 }}>Все документы</Typography>
            </Box>
            {rootFolders.map(f => (
              <Box key={f.id}
                onClick={() => setCurrentFolderId(f.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, cursor: 'pointer',
                  background: currentFolderId === f.id ? 'rgba(201,168,76,0.10)' : 'transparent',
                  color: currentFolderId === f.id ? '#C9A84C' : '#94A3B8',
                  '&:hover': { background: 'rgba(201,168,76,0.06)' },
                }}
              >
                <FolderRoundedIcon fontSize="small" sx={{ color: currentFolderId === f.id ? '#C9A84C' : '#64748B' }} />
                <Typography variant="body2" sx={{ fontWeight: currentFolderId === f.id ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Main grid */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
          ) : visibleItems.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#64748B' }}>
              <FolderOpenRoundedIcon sx={{ fontSize: 48, color: '#334155', mb: 1 }} />
              <Typography variant="body2">
                {searchResults !== null ? 'Ничего не найдено' : 'Папка пуста. Создайте папку или загрузите файл.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {visibleItems.map((item, i) => {
                const isFolder = item.type === 'folder';
                const { Icon, color } = isFolder ? { Icon: FolderRoundedIcon, color: '#C9A84C' } : fileIcon(item);
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <Box
                      onClick={() => openItem(item)}
                      sx={{
                        p: 2, borderRadius: 3, cursor: 'pointer', position: 'relative',
                        background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))',
                        border: '1px solid rgba(201,168,76,0.08)',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: `${color}40`, transform: 'translateY(-2px)' },
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, item }); }}
                        sx={{ position: 'absolute', top: 4, right: 4, color: '#475569', p: { xs: 1, sm: 0.5 }, '&:hover': { color: '#F1F5F9', background: 'rgba(255,255,255,0.06)' } }}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                      <Box sx={{ textAlign: 'center', mb: 1 }}>
                        <Icon sx={{ fontSize: 52, color }} />
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </Typography>
                      {searchResults !== null && (
                        <Typography variant="caption" title={item.parentId != null ? (folderPaths[item.parentId] || '') : 'Все документы'}
                          sx={{ color: '#475569', textAlign: 'center', display: 'block', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.parentId != null
                            ? (folderPaths[item.parentId] === undefined ? '…' : (folderPaths[item.parentId] || 'Все документы'))
                            : 'Все документы'}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: '#64748B', textAlign: 'center', display: 'block', fontSize: 10 }}>
                        {isFolder ? 'папка' : fmtSize(item.fileSize) || 'файл'}
                      </Typography>
                    </Box>
                  </motion.div>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Context menu */}
      <Menu open={!!menuAnchor} anchorEl={menuAnchor?.el || null} onClose={() => setMenuAnchor(null)}>
        {menuAnchor?.item.type === 'file' && (menuAnchor.item.hasFile ?? !!menuAnchor.item.fileUrl) && (
          <MenuItem onClick={async () => {
            const it = menuAnchor!.item; setMenuAnchor(null);
            // Safari (iPhone): окно нужно открыть синхронно, до await presigned-ссылки.
            if (it.fileUrl) { window.open(it.fileUrl, '_blank', 'noopener,noreferrer'); return; }
            const w = window.open('', '_blank', 'noopener,noreferrer');
            try {
              const { url } = await docsApi.url(it.id);
              if (w) w.location.href = url;
            } catch (e) {
              if (w) w.close();
              setError(e instanceof Error ? e.message : 'Не удалось открыть файл');
            }
          }}>
            <OpenInNewRoundedIcon fontSize="small" sx={{ mr: 1, color: '#94A3B8' }} /> Открыть в новой вкладке
          </MenuItem>
        )}
        {menuAnchor?.item.type === 'file' && (menuAnchor.item.hasFile ?? !!menuAnchor.item.fileUrl) && (
          <MenuItem onClick={async () => {
            const it = menuAnchor!.item; setMenuAnchor(null);
            let url = it.fileUrl;
            if (!url) { try { url = (await docsApi.url(it.id)).url; } catch { return; } }
            if (!url) return;
            const a = document.createElement('a');
            a.href = url; a.download = it.name; a.click();
          }}>
            <DownloadRoundedIcon fontSize="small" sx={{ mr: 1, color: '#94A3B8' }} /> Скачать
          </MenuItem>
        )}
        {menuAnchor && <Divider />}
        <MenuItem onClick={() => {
          if (!menuAnchor) return;
          setRenameFor(menuAnchor.item); setRenameValue(menuAnchor.item.name);
          setMenuAnchor(null);
        }}>
          <DriveFileRenameOutlineRoundedIcon fontSize="small" sx={{ mr: 1, color: '#94A3B8' }} /> Переименовать
        </MenuItem>
        <MenuItem onClick={() => { if (menuAnchor) { setDeleteFor(menuAnchor.item); setMenuAnchor(null); } }}
          sx={{ color: '#EF4444' }}>
          <DeleteRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Удалить
        </MenuItem>
      </Menu>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Новая папка</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {breadcrumbs.length > 0 && (
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Будет создана внутри: <b>{breadcrumbs[breadcrumbs.length - 1].name}</b>
              </Typography>
            )}
            <TextField fullWidth autoFocus size="small" label="Название папки"
              value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              placeholder="например: Регламенты"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Создать</Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameFor} onClose={() => setRenameFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Переименовать</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth autoFocus size="small" label="Новое название"
              value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameFor(null)}>Отмена</Button>
          <Button variant="contained" onClick={handleRename} disabled={!renameValue.trim()}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* Подтверждение удаления */}
      <ConfirmDialog
        open={!!deleteFor}
        title={deleteFor?.type === 'folder' ? 'Удалить папку?' : 'Удалить файл?'}
        text={deleteFor?.type === 'folder'
          ? <>Папка «{deleteFor.name}» будет удалена вместе со всем содержимым. Действие необратимо.</>
          : deleteFor
            ? <>Файл «{deleteFor.name}» будет удалён. Действие необратимо.</>
            : ''}
        confirmLabel="Удалить"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => { if (!deleting) setDeleteFor(null); }}
      />
    </Box>
  );
}
