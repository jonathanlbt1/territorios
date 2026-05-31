import { Check, X, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import PropTypes from 'prop-types';

function formatDate(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export default function NotificationsMenu({
  open,
  notifications = [],
  onClose,
  onMarkRead,
  onMarkAllRead,
  onOpenAssignment,
  onDelete,
  placement = 'mobile',
}) {
  const unreadExists = useMemo(() => notifications.some(n => !n.is_read), [notifications]);

  if (!open) return null;

  const isDesktop = placement === 'desktop';
  const wrapperClasses = isDesktop
    ? 'absolute right-0 md:right-auto md:left-0 mt-2 w-96 max-w-[95vw]'
    : 'fixed top-2 left-2 right-2 w-auto';

  return (
    <div className={`${wrapperClasses} z-50`}>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 bg-white dark:bg-slate-900">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">Notificações</h3>
          <div className="flex items-center gap-2">
            {unreadExists && (
              <button
                onClick={onMarkAllRead}
                className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
              Nenhuma notificação por aqui.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => (
                <li key={n.id} className={`p-4 ${!n.is_read ? 'bg-slate-50 dark:bg-slate-800/40' : ''}`}>
                  <div className="flex items-start gap-3">
                    {!n.is_read ? (
                      <span className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    ) : (
                      <span className="mt-1 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{n.title}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(n.created_at)}</span>
                      </div>
                      {n.message && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        {n.assignment_id && (
                          <button
                            onClick={() => onOpenAssignment?.(n.assignment_id, n)}
                            className="text-xs px-2 py-1 rounded-lg bg-primary-600/10 text-primary-700 dark:text-primary-300 hover:bg-primary-600/20"
                          >
                            Abrir designação
                          </button>
                        )}
                        {!n.is_read && (
                          <button
                            onClick={() => onMarkRead?.(n.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Marcar lida
                          </button>
                        )}
                        <button
                          onClick={() => onDelete?.(n.id)}
                          className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 inline-flex items-center gap-1"
                          aria-label="Apagar notificação"
                        >
                          <Trash2 className="w-3 h-3" /> Apagar
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

NotificationsMenu.propTypes = {
  open: PropTypes.bool,
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      title: PropTypes.string,
      message: PropTypes.string,
      is_read: PropTypes.bool,
      created_at: PropTypes.string,
      assignment_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
  onClose: PropTypes.func,
  onMarkRead: PropTypes.func,
  onMarkAllRead: PropTypes.func,
  onOpenAssignment: PropTypes.func,
  onDelete: PropTypes.func,
  placement: PropTypes.oneOf(['mobile', 'desktop']),
};
