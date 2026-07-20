import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Tooltip, IconButton, Divider, Button, Drawer } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import MoveToInboxRoundedIcon from '@mui/icons-material/MoveToInboxRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import ContactSupportRoundedIcon from '@mui/icons-material/ContactSupportRounded';
import { logout, getCurrentUser, currentSectionAccess } from '../../auth/auth';
import { canAccess, ROLE_LABEL, ROLE_COLOR, type Role } from '../../auth/roles';
import { agentsApi } from '../../api/agents';
import { supportApi } from '../../api/support';
import { subscriptionAdminApi } from '../../api/subscription';
import { adRequestsApi } from '../../api/adRequests';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import Logo, { LogoIcon } from '../Logo';
import NotificationsDialog from '../NotificationsDialog';
import { casesAdminApi } from '../../api/cases';

export default function Sidebar({ isMobile = false, mobileOpen = false, onClose = () => {} }: { isMobile?: boolean; mobileOpen?: boolean; onClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [adUnread, setAdUnread] = useState(0);
  const [casesQueue, setCasesQueue] = useState(0);
  const [dealApprovals, setDealApprovals] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = (user?.role || 'agent') as Role;
  const sectionAccess = currentSectionAccess();

  // Бейджи: отзывы/тикеты/заявки рекламы. Поллинг каждые 20с — чтобы новые уведомления
  // появлялись без перезагрузки страницы. Дёргаем только доступные роли разделы.
  useEffect(() => {
    const load = () => {
      const u = getCurrentUser();
      const r = (u?.role || 'agent') as Role;
      const sa = currentSectionAccess();
      if (canAccess(r, '/agents', sa)) agentsApi.pendingReviews().catch(() => []).then(x => setPendingReviews((x as unknown[]).length));
      if (canAccess(r, '/support', sa)) supportApi.list().catch(() => []).then(t => setOpenTickets((t as { status: string }[]).filter(y => y.status === 'open').length));
      if (canAccess(r, '/subscription-claims', sa)) subscriptionAdminApi.pending().catch(() => []).then(p => setPendingClaims((p as unknown[]).length));
      // Отдел рекламы: новые в очереди (не взяты, не закрыты) + заявки с непрочитанными сообщениями.
      if (canAccess(r, '/ad-requests', sa)) adRequestsApi.list().catch(() => []).then(l => {
        const arr = l as { unread?: number; assignee_id?: number | null; status?: string }[];
        setAdUnread(arr.filter(y => (y.unread || 0) > 0 || (!y.assignee_id && y.status !== 'done' && y.status !== 'cancelled')).length);
      });
      // Заявки специалистам (юр/ипотека): незанятые задачи в очереди.
      if (canAccess(r, '/cases', sa)) casesAdminApi.queue().catch(() => []).then(q => setCasesQueue((q as unknown[]).length));
      // Сделки юристов, ждущие согласования (бейдж «горит» у админа/суперадмина).
      if (canAccess(r, '/deals', sa)) casesAdminApi.approvalsCount().catch(() => ({ count: 0 })).then(x => setDealApprovals(x?.count || 0));
    };
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [location.pathname]);

  const allNavItems = [
    { path: '/dashboard', label: 'Обзор', icon: <DashboardRoundedIcon /> },
    { path: '/inbox', label: 'Инбокс', icon: <MoveToInboxRoundedIcon /> },
    { path: '/agents', label: 'Агенты', icon: <PeopleRoundedIcon />, badge: pendingReviews || null, tooltip: pendingReviews ? `${pendingReviews} отзывов на модерации` : '' },
    { path: '/deals', label: 'Сделки', icon: <HandshakeRoundedIcon />, badge: dealApprovals || null, tooltip: dealApprovals ? `${dealApprovals} сделок на согласовании` : '' },
    { path: '/cases', label: 'Заявки', icon: <AssignmentRoundedIcon />, badge: casesQueue || null, tooltip: casesQueue ? `${casesQueue} заявок в очереди` : '' },
    { path: '/ad-requests', label: 'Отдел рекламы', icon: <CampaignRoundedIcon />, badge: adUnread || null, tooltip: adUnread ? `${adUnread} заявок с новыми сообщениями` : '' },
    { path: '/shares', label: 'Акции', icon: <DiamondRoundedIcon /> },
    { path: '/academy', label: 'Академия', icon: <SchoolRoundedIcon /> },
    { path: '/news', label: 'Новости', icon: <ArticleRoundedIcon /> },
    { path: '/docs', label: 'База данных', icon: <FolderRoundedIcon /> },
    { path: '/ai-prompts', label: 'AI-промпты', icon: <AutoAwesomeRoundedIcon /> },
    { path: '/ai-analytics', label: 'AI-аналитика', icon: <InsightsRoundedIcon /> },
    { path: '/backoffice', label: 'Команда', icon: <SupportAgentRoundedIcon /> },
    { path: '/support', label: 'Поддержка', icon: <ContactSupportRoundedIcon />, badge: openTickets || null, tooltip: openTickets ? `${openTickets} открытых тикетов` : '' },
    { path: '/subscriptions', label: 'Абон. плата', icon: <ReceiptLongRoundedIcon /> },
    { path: '/subscription-claims', label: 'Заявки на оплату', icon: <ReceiptLongRoundedIcon />, badge: pendingClaims || null, tooltip: pendingClaims ? `${pendingClaims} заявок на подтверждение` : '' },
    { path: '/analytics', label: 'Аналитика', icon: <BarChartRoundedIcon /> },
    { path: '/reports', label: 'Отчёты', icon: <AssessmentRoundedIcon /> },
    { path: '/settings', label: 'Настройки', icon: <SettingsRoundedIcon /> },
  ];
  const navItems = allNavItems.filter(i => canAccess(role, i.path, sectionAccess));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  // На мобиле после перехода закрываем выезжающую панель.
  const handleNav = (path: string) => { navigate(path); if (isMobile) onClose(); };

  const content = (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #0A1020 0%, #080C18 100%)', borderRight: isMobile ? 'none' : '1px solid rgba(201,168,76,0.1)', position: isMobile ? 'static' : 'sticky', top: 0, overflow: 'hidden' }}>

        {/* Logo */}
        <Box sx={{ p: collapsed ? 1.5 : 2.5, pt: 3, display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5 }}>
          {collapsed ? (
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <LogoIcon size={44} premium />
            </Box>
          ) : (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <Logo variant="full" size={40} premium />
                <Box sx={{ display: 'flex', flexDirection: 'column', borderLeft: '2px solid rgba(239,68,68,0.4)', pl: 1.2, lineHeight: 1.05 }}>
                  <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 800, letterSpacing: '0.06em', fontSize: 10 }}>
                    ADMIN
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 800, letterSpacing: '0.06em', fontSize: 10 }}>
                    PANEL
                  </Typography>
                </Box>
              </motion.div>
            </AnimatePresence>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)', mx: 2 }} />

        {/* Nav */}
        <List sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, py: 2, display: 'flex', flexDirection: 'column', gap: 0.5, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(201,168,76,0.25)', borderRadius: 2 } }}>
          {navItems.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <ListItem key={item.path} disablePadding>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItemButton onClick={() => handleNav(item.path)} sx={{ borderRadius: 2.5, minHeight: 44, px: collapsed ? 1.5 : 2, justifyContent: collapsed ? 'center' : 'flex-start', position: 'relative', background: active ? 'linear-gradient(135deg, rgba(201,168,76,0.14), rgba(201,168,76,0.07))' : 'transparent', border: active ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent', color: active ? '#C9A84C' : '#94A3B8', '&:hover': { background: 'rgba(201,168,76,0.07)', color: '#E2C97E', border: '1px solid rgba(201,168,76,0.12)' }, transition: 'all 0.2s' }}>
                    {active && <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: '#C9A84C', borderRadius: '0 3px 3px 0' }} />}
                    <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, color: 'inherit' }}>{item.icon}</ListItemIcon>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <ListItemText primary={item.label} slotProps={{ primary: { style: { fontSize: 14, fontWeight: active ? 700 : 500 } } }} />
                          {item.badge ? (
                            <Tooltip title={('tooltip' in item && item.tooltip) || ''}>
                              <Box sx={{ background: active ? '#C9A84C' : 'rgba(239,68,68,0.85)', color: active ? '#0A0E1A' : '#fff', borderRadius: 10, px: 0.8, py: 0.1, fontSize: 10, fontWeight: 800, minWidth: 20, textAlign: 'center', lineHeight: '18px' }}>
                                {item.badge}
                              </Box>
                            </Tooltip>
                          ) : null}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)', mx: 2 }} />

        <Box sx={{ p: 1.5, pb: 2.5 }}>
          {!collapsed && (
            <Box sx={{ p: 1.5, borderRadius: 2.5, background: `${ROLE_COLOR[role] || '#EF4444'}14`, border: `1px solid ${ROLE_COLOR[role] || '#EF4444'}26`, mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#F1F5F9', display: 'block', fontSize: 12 }}>{user?.name || 'Администратор'}</Typography>
              <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11, display: 'block' }}>{user?.email || ''}</Typography>
              <Typography variant="caption" sx={{ color: ROLE_COLOR[role] || '#EF4444', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', mt: 0.3, display: 'block' }}>
                {ROLE_LABEL[role] || role}
              </Typography>
            </Box>
          )}
          {!collapsed ? (
            <Button fullWidth size="small" variant="outlined" startIcon={<NotificationsActiveRoundedIcon fontSize="small" />} onClick={() => setNotifOpen(true)}
              sx={{ mb: 1, color: '#C9A84C', borderColor: 'rgba(201,168,76,0.3)', textTransform: 'none', justifyContent: 'flex-start', '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.06)' } }}>
              Уведомления и бот
            </Button>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
              <Tooltip title="Уведомления и бот" placement="right">
                <IconButton size="small" onClick={() => setNotifOpen(true)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                  <NotificationsActiveRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center' }}>
            <Tooltip title="Выйти" placement="right">
              <IconButton size="small" onClick={handleLogout} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {!isMobile && (!collapsed ? (
              <IconButton size="small" onClick={() => setCollapsed(true)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                <ChevronLeftRoundedIcon fontSize="small" />
              </IconButton>
            ) : (
              <IconButton size="small" onClick={() => setCollapsed(false)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                <ChevronRightRoundedIcon fontSize="small" />
              </IconButton>
            ))}
          </Box>
        </Box>
      </Box>
  );

  return (
    <>
      {isMobile ? (
        <Drawer variant="temporary" open={mobileOpen} onClose={onClose} ModalProps={{ keepMounted: true }}
          slotProps={{ paper: { sx: { width: 260, border: 'none', backgroundColor: 'transparent', backgroundImage: 'none', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' } } }}>
          {content}
        </Drawer>
      ) : (
        <motion.div animate={{ width: collapsed ? 72 : 248 }} transition={{ duration: 0.3 }} style={{ flexShrink: 0, overflow: 'hidden' }}>
          {content}
        </motion.div>
      )}
      <NotificationsDialog open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
