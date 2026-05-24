import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Badge, Chip, Popover, List, ListItem, ListItemAvatar, ListItemText, Avatar, Button, Divider,
  Dialog, DialogContent, TextField, InputAdornment, Menu, MenuItem, Tooltip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Sidebar from './Sidebar';
import { logout, PORTAL_URL } from '../../auth/auth';
import { agents, deals } from '../../data/mockData';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Обзор', subtitle: 'Общая статистика платформы' },
  '/agents': { title: 'Управление агентами', subtitle: 'Создание, редактирование, MLM-структура' },
  '/deals': { title: 'Сделки', subtitle: 'Верификация и управление сделками' },
  '/shares': { title: 'Акции', subtitle: 'Эмиссия, курс, передача акций' },
  '/academy': { title: 'Академия', subtitle: 'Управление курсами и уроками' },
  '/news': { title: 'Новости', subtitle: 'Публикации и редактор контента' },
  '/analytics': { title: 'Аналитика', subtitle: 'BI-дашборд и отчёты' },
  '/settings': { title: 'Настройки', subtitle: 'Комиссии, интеграции, параметры системы' },
};

interface AdminNotification {
  id: number;
  type: 'deal' | 'agent' | 'shares' | 'alert';
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

const initNotifs: AdminNotification[] = [
  { id: 1, type: 'deal', title: 'Новая сделка ожидает верификации', desc: 'Кулаков С.В., Орлова Н.С. — 12 000 000 ₽', time: '5 мин назад', unread: true },
  { id: 2, type: 'agent', title: 'Зарегистрирован новый агент', desc: 'Михалева Полина — приглашена Мухиным В.А.', time: '15 мин назад', unread: true },
  { id: 3, type: 'deal', title: 'Сделка ожидает оплаты', desc: 'Мухин В.А., Козлов Д.П. — 6 200 000 ₽', time: '1 час назад', unread: true },
  { id: 4, type: 'shares', title: 'Операция с акциями', desc: 'Выкуп 300 акций у Санкина А.А.', time: '2 часа назад', unread: true },
  { id: 5, type: 'alert', title: 'Достигнут уровень комиссии', desc: 'Радченко Д.В. перешёл на 95% (L3)', time: '5 часов назад', unread: true },
];

const notifConfig = {
  deal: { icon: <HandshakeRoundedIcon sx={{ fontSize: 18 }} />, color: '#22C55E' },
  agent: { icon: <PersonAddRoundedIcon sx={{ fontSize: 18 }} />, color: '#3B82F6' },
  shares: { icon: <DiamondRoundedIcon sx={{ fontSize: 18 }} />, color: '#C9A84C' },
  alert: { icon: <WarningAmberRoundedIcon sx={{ fontSize: 18 }} />, color: '#F59E0B' },
};

interface SearchResult {
  type: 'agent' | 'deal' | 'page';
  label: string;
  sub: string;
  path: string;
  icon: React.ReactNode;
}

const pageResults: SearchResult[] = [
  { type: 'page', label: 'Обзор', sub: 'Дашборд платформы', path: '/dashboard', icon: <DashboardRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Управление агентами', sub: 'Создание, MLM-дерево', path: '/agents', icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Сделки', sub: 'Верификация и оплата', path: '/deals', icon: <HandshakeRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Акции', sub: 'Курс и операции', path: '/shares', icon: <DiamondRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Академия', sub: 'Курсы и уроки', path: '/academy', icon: <SchoolRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Новости', sub: 'Публикации', path: '/news', icon: <ArticleRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Аналитика', sub: 'BI-отчёты', path: '/analytics', icon: <BarChartRoundedIcon sx={{ fontSize: 18 }} /> },
  { type: 'page', label: 'Настройки', sub: 'Комиссии, интеграции', path: '/settings', icon: <SettingsRoundedIcon sx={{ fontSize: 18 }} /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = Object.entries(pageTitles).find(([path]) => location.pathname === path || location.pathname.startsWith(path + '/'));
  const { title, subtitle } = page?.[1] || { title: 'Admin', subtitle: '' };

  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);
  const [adminAnchor, setAdminAnchor] = useState<HTMLElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifs, setNotifs] = useState(initNotifs);

  const unreadCount = notifs.filter(n => n.unread).length;

  // Ctrl/Cmd + K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleMarkAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, unread: false })));

  const handleLogout = () => {
    setAdminAnchor(null);
    logout();
    navigate('/login', { replace: true });
  };

  const handleGoToPortal = () => {
    setAdminAnchor(null);
    // Open in a new tab so the admin panel stays open
    window.open(`${PORTAL_URL}/dashboard`, '_blank', 'noopener,noreferrer');
  };

  // Build search results dynamically
  const q = searchQuery.trim().toLowerCase();
  const searchResults: SearchResult[] = q ? [
    ...pageResults.filter(p => p.label.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q)),
    ...agents
      .filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.city.toLowerCase().includes(q))
      .slice(0, 5)
      .map(a => ({
        type: 'agent' as const,
        label: a.name,
        sub: `${a.city} · ${a.commission}% · ${a.vkdYear.toLocaleString('ru-RU')} ₽ ВКД`,
        path: '/agents',
        icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />,
      })),
    ...deals
      .filter(d => d.clientName.toLowerCase().includes(q) || d.address.toLowerCase().includes(q) || d.agentName.toLowerCase().includes(q))
      .slice(0, 5)
      .map(d => ({
        type: 'deal' as const,
        label: `${d.clientName} — ${d.vkd.toLocaleString('ru-RU')} ₽`,
        sub: `${d.agentName.split(' ').slice(0, 2).join(' ')} · ${d.address.slice(0, 40)}`,
        path: '/deals',
        icon: <HandshakeRoundedIcon sx={{ fontSize: 18 }} />,
      })),
  ] : pageResults;

  const typeColor = { agent: '#3B82F6', deal: '#22C55E', page: '#C9A84C' };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#080C18' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 4, py: 2.5, background: 'rgba(8,12,24,0.95)', borderBottom: '1px solid rgba(201,168,76,0.08)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <motion.div key={location.pathname} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9', lineHeight: 1.2 }}>{title}</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>{subtitle}</Typography>
          </motion.div>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Меню администратора">
              <Chip
                label="ADMIN"
                size="small"
                onClick={(e) => setAdminAnchor(e.currentTarget)}
                sx={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer', '&:hover': { background: 'rgba(239,68,68,0.2)' } }}
              />
            </Tooltip>

            <Tooltip title="Поиск (Ctrl + K)">
              <IconButton size="small" onClick={() => setSearchOpen(true)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                <SearchRoundedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Уведомления">
              <Badge badgeContent={unreadCount} sx={{ '& .MuiBadge-badge': { background: '#EF4444', color: '#fff', fontSize: 10 } }}>
                <IconButton
                  size="small"
                  onClick={(e) => setNotifAnchor(e.currentTarget)}
                  sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}
                >
                  <NotificationsRoundedIcon />
                </IconButton>
              </Badge>
            </Tooltip>
          </Box>

          {/* ADMIN menu */}
          <Menu
            anchorEl={adminAnchor}
            open={!!adminAnchor}
            onClose={() => setAdminAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: {
              mt: 1.5, minWidth: 240,
              background: 'linear-gradient(135deg, #0F1629 0%, #0A0E1A 100%)',
              border: '1px solid rgba(201,168,76,0.15)', borderRadius: 2.5,
            } } }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: 11 }}>Вы вошли как</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Администратор</Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: 11 }}>admin@w24.agency</Typography>
            </Box>
            <MenuItem onClick={() => { setAdminAnchor(null); navigate('/settings'); }} sx={{ py: 1.2 }}>
              <SettingsRoundedIcon sx={{ fontSize: 18, mr: 1.5, color: '#94A3B8' }} />
              <Typography variant="body2">Настройки системы</Typography>
            </MenuItem>
            <MenuItem onClick={handleGoToPortal} sx={{ py: 1.2 }}>
              <OpenInNewRoundedIcon sx={{ fontSize: 18, mr: 1.5, color: '#C9A84C' }} />
              <Typography variant="body2" sx={{ color: '#C9A84C', fontWeight: 700 }}>Открыть портал агента</Typography>
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />
            <MenuItem onClick={handleLogout} sx={{ py: 1.2 }}>
              <LogoutRoundedIcon sx={{ fontSize: 18, mr: 1.5, color: '#EF4444' }} />
              <Typography variant="body2" sx={{ color: '#EF4444' }}>Выйти</Typography>
            </MenuItem>
          </Menu>

          {/* Notifications popover */}
          <Popover
            open={!!notifAnchor}
            anchorEl={notifAnchor}
            onClose={() => setNotifAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: {
              mt: 1.5, width: 400, maxHeight: 540,
              background: 'linear-gradient(135deg, #0F1629 0%, #0A0E1A 100%)',
              border: '1px solid rgba(201,168,76,0.15)', borderRadius: 3,
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            } } }}
          >
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
              <Box>
                <Typography sx={{ fontWeight: 800, color: '#F1F5F9' }}>Уведомления</Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>{unreadCount} непрочитанных</Typography>
              </Box>
              {unreadCount > 0 && (
                <Button size="small" startIcon={<DoneAllRoundedIcon sx={{ fontSize: 14 }} />} onClick={handleMarkAllRead} sx={{ color: '#C9A84C', fontSize: 11, py: 0.3 }}>
                  Прочитать все
                </Button>
              )}
            </Box>
            <List sx={{ p: 0, maxHeight: 420, overflow: 'auto' }}>
              {notifs.map((n) => {
                const cfg = notifConfig[n.type];
                return (
                  <ListItem
                    key={n.id}
                    onClick={() => {
                      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, unread: false } : x));
                      if (n.type === 'deal') navigate('/deals');
                      if (n.type === 'agent') navigate('/agents');
                      if (n.type === 'shares') navigate('/shares');
                      setNotifAnchor(null);
                    }}
                    sx={{
                      px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: n.unread ? 'rgba(201,168,76,0.04)' : 'transparent',
                      '&:hover': { background: 'rgba(201,168,76,0.08)' },
                      cursor: 'pointer', position: 'relative',
                    }}
                  >
                    {n.unread && <Box sx={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />}
                    <ListItemAvatar>
                      <Avatar sx={{ background: `${cfg.color}20`, color: cfg.color, width: 36, height: 36 }}>{cfg.icon}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: n.unread ? 700 : 500, fontSize: 13 }}>{n.title}</Typography>}
                      secondary={
                        <Box component="span">
                          <Typography variant="caption" component="span" sx={{ color: '#94A3B8', display: 'block', fontSize: 12 }}>{n.desc}</Typography>
                          <Typography variant="caption" component="span" sx={{ color: '#475569', display: 'block', fontSize: 11, mt: 0.3 }}>{n.time}</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Popover>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 4, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>

      {/* Global search dialog */}
      <Dialog
        open={searchOpen}
        onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
        maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: 'linear-gradient(135deg, #0F1629 0%, #0A0E1A 100%)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 3 } } }}
      >
        <DialogContent sx={{ p: 0 }}>
          <TextField
            autoFocus fullWidth
            placeholder="Поиск по агентам, сделкам, разделам…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            variant="standard"
            sx={{
              px: 3, py: 2,
              borderBottom: '1px solid rgba(201,168,76,0.1)',
              '& .MuiInputBase-root': { fontSize: 16, color: '#F1F5F9' },
              '& .MuiInputBase-root:before, & .MuiInputBase-root:after': { display: 'none' },
            }}
            slotProps={{ input: {
              startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B' }} /></InputAdornment>,
              endAdornment: <InputAdornment position="end"><Chip label="ESC" size="small" sx={{ background: 'rgba(255,255,255,0.06)', color: '#64748B', fontSize: 10, fontWeight: 700, height: 20 }} /></InputAdornment>,
            } }}
          />
          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
            <AnimatePresence>
              {searchResults.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>Ничего не найдено по запросу «{searchQuery}»</Typography>
                </Box>
              ) : (
                <List sx={{ p: 1 }}>
                  {searchResults.map((r, i) => (
                    <motion.div key={`${r.type}-${i}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                      <ListItem
                        onClick={() => { navigate(r.path); setSearchOpen(false); setSearchQuery(''); }}
                        sx={{
                          borderRadius: 2, mb: 0.3, cursor: 'pointer',
                          '&:hover': { background: 'rgba(201,168,76,0.08)' },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ background: `${typeColor[r.type]}20`, color: typeColor[r.type], width: 36, height: 36 }}>{r.icon}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600 }}>{r.label}</Typography>}
                          secondary={<Typography variant="caption" sx={{ color: '#64748B', fontSize: 12 }}>{r.sub}</Typography>}
                        />
                        <Chip label={r.type === 'agent' ? 'Агент' : r.type === 'deal' ? 'Сделка' : 'Раздел'} size="small" sx={{ background: `${typeColor[r.type]}15`, color: typeColor[r.type], fontSize: 10, fontWeight: 700, height: 20 }} />
                      </ListItem>
                    </motion.div>
                  ))}
                </List>
              )}
            </AnimatePresence>
          </Box>
          <Box sx={{ px: 2, py: 1.2, borderTop: '1px solid rgba(201,168,76,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>
              <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 3, fontFamily: 'inherit' }}>↑↓</kbd> навигация ·
              <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 3, marginLeft: 6, fontFamily: 'inherit' }}>↵</kbd> открыть
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>
              {searchResults.length} результатов
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
