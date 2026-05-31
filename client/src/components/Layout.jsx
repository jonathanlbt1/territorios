import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Home,
  Map,
  Users,
  FileText,
  History,
  LogOut,
  MapPin,
  Menu,
  X,
  Bell,
  ClipboardList,
  LayoutGrid,
  Sun,
  Moon,
  User
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import NotificationsMenu from './NotificationsMenu';

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifBtnRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get(`/users/${user.id}/notifications`);
      const list = response.data || [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await api.put(`/users/notifications/${id}/read`);
      await fetchNotifications();
    } catch (e) {
      console.error('Erro ao marcar notificação como lida', e);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.put(`/users/notifications/read-all`);
      await fetchNotifications();
    } catch (e) {
      console.error('Erro ao marcar todas como lidas', e);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/users/notifications/${id}`);
      await fetchNotifications();
    } catch (e) {
      console.error('Erro ao apagar notificação', e);
    }
  };

  const openAssignmentFromNotification = async (assignmentId, notif) => {
    // Marca como lida antes de navegar (se ainda não estiver)
    if (notif && !notif.is_read) {
      await markNotificationRead(notif.id);
    }
    setNotifOpen(false);
    navigate(`/assignment/${assignmentId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminNavItems = [
    { to: '/admin', icon: Home, label: 'Dashboard', exact: true },
    { to: '/admin/assignments', icon: ClipboardList, label: 'Designações' },
    { to: '/admin/territories', icon: MapPin, label: 'Territórios' },
    { to: '/admin/users', icon: Users, label: 'Usuários' },
    { to: '/admin/reports', icon: FileText, label: 'Relatórios' },
    { to: '/admin/history', icon: History, label: 'Histórico' },
    { to: '/general-maps', icon: LayoutGrid, label: 'Mapas Gerais' },
  ];

  const dirigenteNavItems = [
    { to: '/dirigente', icon: Home, label: 'Meus Territórios', exact: true },
    { to: '/dirigente/history', icon: History, label: 'Meu Histórico' },
    { to: '/general-maps', icon: LayoutGrid, label: 'Mapas Gerais' },
    { to: '/dirigente/my-user', icon: User, label: 'Meus Dados' },
  ];

  const navItems = isAdmin ? adminNavItems : dirigenteNavItems;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </button>
          
          <div className="flex items-center gap-2">
            <Map className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <span className="font-display font-semibold text-slate-800 dark:text-white">Territórios</span>
          </div>

          <div className="flex items-center gap-1 relative">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>
            <button
              ref={notifBtnRef}
              onClick={() => setNotifOpen((v) => !v)}
              className="p-2 -mr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 relative"
              aria-label="Abrir notificações"
            >
              <Bell className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationsMenu
              open={notifOpen}
              notifications={notifications}
              onClose={() => setNotifOpen(false)}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onOpenAssignment={openAssignmentFromNotification}
              onDelete={deleteNotification}
              placement="mobile"
            />
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-50
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <Map className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-display font-semibold text-slate-800 dark:text-white">Territórios</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Gestão de Territórios</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>

          {/* User Info + Notifications (desktop) */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between px-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                <span className="text-slate-600 dark:text-slate-200 font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 ml-3">
                <p className="font-medium text-slate-800 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
              </div>

              {/* Desktop notifications button */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 relative"
                  aria-label="Abrir notificações"
                >
                  <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <NotificationsMenu
                  open={notifOpen}
                  notifications={notifications}
                  onClose={() => setNotifOpen(false)}
                  onMarkRead={markNotificationRead}
                  onMarkAllRead={markAllNotificationsRead}
                  onOpenAssignment={openAssignmentFromNotification}
                  onDelete={deleteNotification}
                  placement="desktop"
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Theme Toggle & Logout */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              onClick={toggleTheme}
              className="nav-item w-full"
            >
              {isDark ? (
                <>
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="nav-item w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pt-16 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav md:hidden">
        <div className="flex items-center justify-around py-1">
          {navItems.slice(0, 5).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `mobile-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default Layout;
