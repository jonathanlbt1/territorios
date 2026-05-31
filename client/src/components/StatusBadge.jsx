import PropTypes from 'prop-types';

const statusLabels = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  returned: 'Devolvido',
  completed: 'Concluído',
  cancelled: 'Cancelado'
};

const resultLabels = {
  complete: 'Completo',
  partial: 'Parcial',
  not_done: 'Não Feito'
};

function StatusBadge({ status, type = 'status' }) {
  const labels = type === 'status' ? statusLabels : resultLabels;
  const className = type === 'status' ? `status-${status}` : `result-${status}`;
  
  return (
    <span className={`status-badge ${className}`}>
      {labels[status] || status}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['status', 'result']),
};

export default StatusBadge;

