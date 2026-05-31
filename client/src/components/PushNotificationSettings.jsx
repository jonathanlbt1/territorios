import { Bell, BellOff, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import usePushNotifications from '../hooks/usePushNotifications';
import { useToast } from '../contexts/ToastContext';

function PushNotificationSettings() {
  const {
    supported,
    subscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    isDenied
  } = usePushNotifications();

  const toast = useToast();

  const handleToggle = async () => {
    if (subscribed) {
      const result = await unsubscribe();
      if (result.success) {
        toast.success('Notificações desativadas');
      } else {
        toast.error('Erro ao desativar notificações');
      }
    } else {
      const result = await subscribe();
      if (result.success) {
        toast.success('Notificações ativadas! Você receberá alertas importantes.');
      } else if (result.error?.includes('denied')) {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
      } else {
        toast.error(result.error || 'Erro ao ativar notificações');
      }
    }
  };

  if (!supported) {
    return (
      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <BellOff className="w-5 h-5 text-slate-400" />
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">
              Notificações não suportadas
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seu navegador ou dispositivo não suporta notificações push.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Permissão bloqueada
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              As notificações foram bloqueadas. Para ativar, acesse as configurações do seu navegador e permita notificações para este site.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {subscribed ? (
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <BellOff className="w-5 h-5 text-slate-400" />
            </div>
          )}
          <div>
            <p className="font-medium text-slate-800 dark:text-white">
              Notificações Push
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {subscribed 
                ? 'Você receberá alertas de novas designações e devoluções'
                : 'Ative para receber alertas importantes no seu dispositivo'
              }
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            ${subscribed 
              ? 'bg-emerald-500' 
              : 'bg-slate-200 dark:bg-slate-600'
            }
            ${loading ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          <span className="sr-only">
            {subscribed ? 'Desativar notificações' : 'Ativar notificações'}
          </span>
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
              transition duration-200 ease-in-out
              ${subscribed ? 'translate-x-5' : 'translate-x-0'}
            `}
          >
            {loading && (
              <Loader2 className="w-3 h-3 text-slate-400 animate-spin absolute top-1 left-1" />
            )}
          </span>
        </button>
      </div>

      {subscribed && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span>Notificações ativas</span>
        </div>
      )}

      {error && !isDenied && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export default PushNotificationSettings;

