import { useState, useEffect, Fragment } from 'react';
import PropTypes from 'prop-types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart2,
  MapPin,
  Calendar,
  AlertCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function AdminReports() {
  const [activeTab, setActiveTab] = useState('coverage');
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState([]);
  const [mostWorked, setMostWorked] = useState([]);
  const [leastWorked, setLeastWorked] = useState([]);
  const [partialFrequency, setPartialFrequency] = useState([]);
  // S-13
  const [assignments, setAssignments] = useState([]);
  const [periodData, setPeriodData] = useState([]);
  const toast = useToast();

  // Filters - Period tab
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Filters - Coverage, Frequency, Partial tabs (similar to S-13)
  const [reportsStartDate, setReportsStartDate] = useState(
    format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')
  );

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, reportsStartDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [
        coverageRes,
        mostWorkedRes,
        leastWorkedRes,
        partialRes,
        periodRes,
        territoryHistoryRes
      ] = await Promise.all([
        api.get('/reports/coverage', { params: { start_date: reportsStartDate } }),
        api.get('/reports/territory-frequency', { params: { order: 'desc', limit: 10, start_date: reportsStartDate } }),
        api.get('/reports/territory-frequency', { params: { order: 'asc', limit: 10, start_date: reportsStartDate } }),
        api.get('/reports/partial-frequency', { params: { start_date: reportsStartDate } }),
        api.get('/reports/work-by-period', { params: { start_date: startDate, end_date: endDate, groupBy: 'month' } }),
        api.get('/reports/territory-history-s13')
      ]);

      setCoverage(coverageRes.data);
      setMostWorked(mostWorkedRes.data);
      setLeastWorked(leastWorkedRes.data);
      setPartialFrequency(partialRes.data);
      setPeriodData(periodRes.data);
      setAssignments(territoryHistoryRes.data || []);
    } catch (error) {
      console.error('Fetch reports error:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'coverage', label: 'Cobertura', icon: MapPin },
    { id: 'frequency', label: 'Frequência', icon: BarChart2 },
    { id: 'partial', label: 'Parciais', icon: AlertCircle },
    { id: 'period', label: 'Por Período', icon: Calendar },
    { id: 's13', label: 'Formulário S-13', icon: FileText }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Relatórios</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Análise de territórios e desempenho</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn flex-shrink-0 ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Filter for Coverage, Frequency, Partial */}
      {['coverage', 'frequency', 'partial'].includes(activeTab) && (
        <div className="card p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="reports-start-date" className="input-label text-xs">Data Inicial</label>
              <input
                id="reports-start-date"
                type="date"
                value={reportsStartDate}
                onChange={(e) => setReportsStartDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="input text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-5">
              Exibindo dados a partir de {format(parseISO(reportsStartDate), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>
      )}

      {/* Coverage Tab */}
      {activeTab === 'coverage' && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 dark:text-white">Cobertura de Territórios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Território</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Localidade</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Trabalhado</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Completos</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Parciais</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Não Feitos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Último</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {coverage.toSorted((a, b) => Number.parseInt(a.territory_number, 10) - Number.parseInt(b.territory_number, 10)).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">Território: {t.territory_number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.locality}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-800 dark:text-white">{t.times_worked || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-emerald-600 dark:text-emerald-400">{t.times_complete || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-amber-600 dark:text-amber-400">{t.times_partial || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-red-600 dark:text-red-400">{t.times_not_done || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {t.last_worked_date 
                        ? format(parseISO(t.last_worked_date), 'dd/MM/yyyy', { locale: ptBR })
                        : <span className="text-amber-500 dark:text-amber-400">Nunca</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Frequency Tab */}
      {activeTab === 'frequency' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-semibold text-slate-800 dark:text-white">Mais Trabalhados</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {mostWorked.map((t, index) => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      index < 3 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">Território: {t.territory_number}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.locality}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{t.times_worked}x</span>
                </div>
              ))}
              {mostWorked.length === 0 && (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400">Sem dados</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h2 className="font-semibold text-slate-800 dark:text-white">Menos Trabalhados</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {leastWorked.map((t, index) => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      Number.parseInt(t.times_worked) === 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">Território: {t.territory_number}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.locality}</p>
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${Number.parseInt(t.times_worked) === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {t.times_worked}x
                  </span>
                </div>
              ))}
              {leastWorked.length === 0 && (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400">Sem dados</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Partial Tab */}
      {activeTab === 'partial' && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 dark:text-white">Territórios com Trabalhos Parciais Frequentes</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Territórios que frequentemente são trabalhados parcialmente</p>
          </div>
          {partialFrequency.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              Nenhum território com trabalhos parciais registrados
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {partialFrequency.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">Território: {t.territory_number} - {t.locality}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t.partial_count} de {t.total_times} trabalhos parciais
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{t.partial_percentage}%</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500">parcial</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* S-13 Tab */}
      {activeTab === 's13' && (
        <S13Form assignments={assignments} />
      )}

      {/* Period Tab */}
      {activeTab === 'period' && (
        <div className="space-y-6">
          <div className="card p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="period-start-date" className="input-label">Data Inicial</label>
                <input
                  id="period-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="period-end-date" className="input-label">Data Final</label>
                <input
                  id="period-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-slate-800 dark:text-white">Trabalhos por Período</h2>
            </div>
            {periodData.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                Nenhum dado para o período selecionado
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {periodData.map(p => (
                  <div key={p.period} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800 dark:text-white">{p.period}</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{p.total_work} trabalhos</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-emerald-600 dark:text-emerald-400">✓ {p.complete} completos</span>
                      <span className="text-amber-600 dark:text-amber-400">◐ {p.partial} parciais</span>
                      <span className="text-red-600 dark:text-red-400">✗ {p.not_done} não feitos</span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex h-2 mt-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                      <div 
                        className="bg-emerald-500" 
                        style={{ width: `${(p.complete / p.total_work) * 100}%` }}
                      />
                      <div 
                        className="bg-amber-500" 
                        style={{ width: `${(p.partial / p.total_work) * 100}%` }}
                      />
                      <div 
                        className="bg-red-500" 
                        style={{ width: `${(p.not_done / p.total_work) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReports;

// --- S-13 Form Component ---
function S13Form({ assignments }) {
  const toast = useToast();
  const [startDateFilter, setStartDateFilter] = useState(
    format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')
  );

  const [dataSource, setDataSource] = useState(assignments || []);
  const [dirigentes, setDirigentes] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    dirigente_id: '',
    assigned_date: '',
    conclusion_date: '',
    status: 'complete'
  });
  const [creatingTarget, setCreatingTarget] = useState(null);
  const [createForm, setCreateForm] = useState({
    dirigente_id: '',
    assigned_date: '',
    conclusion_date: '',
    status: 'complete'
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setDataSource(assignments || []);
  }, [assignments]);

  useEffect(() => {
    const loadDirigentes = async () => {
      try {
        const res = await api.get('/users');
        setDirigentes((res.data || []).filter(u => u.role === 'dirigente' || u.role === 'admin'));
      } catch (err) {
        console.error('Load dirigentes error:', err);
        toast.error('Erro ao carregar dirigentes');
      }
    };
    loadDirigentes();
  }, [toast]);

  const filteredData = Array.isArray(dataSource)
    ? dataSource.filter(a => {
        const workDate = a.validated_at || a.assigned_date || a.created_at;
        if (!workDate) return false;
        return new Date(workDate) >= new Date(startDateFilter);
      })
    : [];

  const safeDate = (value, pattern = 'dd/MM/yy') => {
    try {
      if (!value) return '';
      let str;
      if (typeof value === 'string') {
        str = value;
      } else if (typeof value.toISOString === 'function') {
        str = value.toISOString();
      } else {
        str = String(value);
      }
      const dateOnly = str.substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        return format(parseISO(str), pattern, { locale: ptBR });
      }
      return format(parseISO(dateOnly + 'T12:00:00'), pattern, { locale: ptBR });
    } catch (e) {
      console.error('safeDate error:', e);
      return '';
    }
  };

  const refreshData = async () => {
    try {
      const res = await api.get('/reports/territory-history-s13');
      setDataSource(res.data || []);
    } catch (err) {
      console.error('Refresh S-13 data error:', err);
      toast.error('Erro ao recarregar registros');
    }
  };

  const openEdit = record => {
    setEditingRecord(record);
    setEditForm({
      dirigente_id: record.dirigente_id || '',
      assigned_date: record.assigned_date ? record.assigned_date.substring(0, 10) : '',
      conclusion_date: record.validated_at ? record.validated_at.substring(0, 10) : '',
      status: record.validation_result || 'complete'
    });
  };

  const handleStatusChange = nextStatus => {
    setEditForm(prev => ({
      ...prev,
      status: nextStatus,
      conclusion_date: nextStatus === 'complete' ? prev.conclusion_date || prev.assigned_date : ''
    }));
  };

  const submitEdit = async e => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!editForm.assigned_date) {
      toast.error('Informe a data de designação');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/reports/territory-history-s13/${editingRecord.id}`, {
        dirigente_id: editForm.dirigente_id || null,
        assigned_date: editForm.assigned_date,
        conclusion_date: editForm.status === 'complete' ? editForm.conclusion_date : null,
        status: editForm.status
      });
      toast.success('Registro atualizado com sucesso');
      setEditingRecord(null);
      await refreshData();
    } catch (err) {
      console.error('Update S-13 record error:', err);
      toast.error(err.response?.data?.error || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async record => {
    if (!record) return;
    if (!globalThis.confirm('Deseja excluir este registro do histórico?')) return;
    setDeletingId(record.id);
    try {
      await api.delete(`/reports/territory-history-s13/${record.id}`);
      toast.success('Registro excluído');
      await refreshData();
    } catch (err) {
      console.error('Delete S-13 record error:', err);
      toast.error(err.response?.data?.error || 'Erro ao excluir registro');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = territoryKey => {
    const list = byTerritory[territoryKey] || [];
    const base = list[0];
    setCreatingTarget({
      territory_key: territoryKey,
      territory_id: base?.territory_id
    });
    setCreateForm({
      dirigente_id: '',
      assigned_date: '',
      conclusion_date: '',
      status: 'complete'
    });
  };

  const handleCreateStatusChange = nextStatus => {
    setCreateForm(prev => ({
      ...prev,
      status: nextStatus,
      conclusion_date: nextStatus === 'complete' ? prev.conclusion_date || prev.assigned_date : ''
    }));
  };

  const submitCreate = async e => {
    e.preventDefault();
    if (!creatingTarget?.territory_id) {
      toast.error('Território inválido');
      return;
    }
    if (!createForm.assigned_date) {
      toast.error('Informe a data de designação');
      return;
    }
    setSaving(true);
    try {
      await api.post('/reports/territory-history-s13', {
        territory_id: creatingTarget.territory_id,
        dirigente_id: createForm.dirigente_id || null,
        assigned_date: createForm.assigned_date,
        conclusion_date: createForm.status === 'complete' ? createForm.conclusion_date : null,
        status: createForm.status
      });
      toast.success('Registro criado com sucesso');
      setCreatingTarget(null);
      await refreshData();
    } catch (err) {
      console.error('Create S-13 record error:', err);
      toast.error(err.response?.data?.error || 'Erro ao criar registro');
    } finally {
      setSaving(false);
    }
  };

  const byTerritory = filteredData.reduce((acc, a) => {
    const key = a.territory_number;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const buildTableRows = () => {
    const rows = [];
    const territories = Object.keys(byTerritory).sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
    );

    territories.forEach(tNum => {
      const list = byTerritory[tNum]
        .slice()
        .sort(
          (a, b) =>
            new Date(a.assigned_date || a.created_at) - new Date(b.assigned_date || b.created_at)
        );

      const endDateFor = x => {
        if (x.validation_result === 'partial' || x.validation_result === 'not_done') return null;
        return x.conclusion_date || x.validated_at || x.returned_at || null;
      };
      const startDateFor = x => x.assigned_date || x.created_at || null;

      const lastCompleted =
        list
          .map(x => endDateFor(x))
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0] || '';

      for (let i = 0; i < list.length; i += 4) {
        const chunk = list.slice(i, i + 4);

        const headLine = [
          { content: String(tNum), rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          {
            content: safeDate(lastCompleted, 'dd/MM/yyyy'),
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle' }
          }
        ];

        chunk.forEach(c => {
          const isPartial = c.validation_result === 'partial' || c.validation_result === 'not_done';
          headLine.push({
            content: c.dirigente_name || '-',
            colSpan: 2,
            styles: {
              halign: 'center',
              valign: 'middle',
              textColor: isPartial ? [200, 0, 0] : [0, 0, 0]
            }
          });
        });
        while (headLine.length < 10) headLine.push({ content: '', colSpan: 2 });
        rows.push(headLine);

        const dateLine = [];
        chunk.forEach(c => {
          const isPartial = c.validation_result === 'partial' || c.validation_result === 'not_done';
          const start = safeDate(startDateFor(c));
          const end = isPartial ? '' : safeDate(endDateFor(c));
          dateLine.push(
            {
              content: start,
              styles: { halign: 'center', valign: 'middle', textColor: isPartial ? [200, 0, 0] : [0, 0, 0] }
            },
            {
              content: end,
              styles: { halign: 'center', valign: 'middle', textColor: isPartial ? [200, 0, 0] : [0, 0, 0] }
            }
          );
        });
        while (dateLine.length < 10) dateLine.push('', '');
        rows.push(dateLine);
      }
    });
    return rows;
  };

  const gerarPDF = () => {
    const doc = new jsPDF('landscape');
    const now = new Date();
    const serviceYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();

    const drawPageHeader = () => {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO', doc.internal.pageSize.width / 2, 15, {
        align: 'center'
      });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ano de Serviço: ${serviceYear}`, 14, 25);
    };

    const headRows = [
      [
        { content: 'Terr.\nn.º', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Última data\nconcluída*', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Designado para', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Designado para', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Designado para', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Designado para', colSpan: 2, styles: { halign: 'center' } }
      ],
      [
        { content: 'Data da\ndesignação', styles: { halign: 'center' } },
        { content: 'Data da\nconclusão', styles: { halign: 'center' } },
        { content: 'Data da\ndesignação', styles: { halign: 'center' } },
        { content: 'Data da\nconclusão', styles: { halign: 'center' } },
        { content: 'Data da\ndesignação', styles: { halign: 'center' } },
        { content: 'Data da\nconclusão', styles: { halign: 'center' } },
        { content: 'Data da\ndesignação', styles: { halign: 'center' } },
        { content: 'Data da\nconclusão', styles: { halign: 'center' } }
      ]
    ];

    const bodyData = buildTableRows();

    autoTable(doc, {
      startY: 30,
      head: headRows,
      body: bodyData,
      theme: 'grid',
      margin: { top: 30, right: 14, bottom: 18, left: 14 },
      styles: { fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 25 } },
      didDrawPage: data => {
        drawPageHeader();
        const pageHeight = doc.internal.pageSize.getHeight();
        const firstLineY = Math.min((data.cursor?.y || 0) + 4, pageHeight - 10);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          '*Ao iniciar uma nova folha, use esta coluna para registrar a data em que cada território foi concluído pela última vez.',
          14,
          firstLineY
        );
        doc.text('S-13-T  01/22', 14, firstLineY + 3.5);
      }
    });
    doc.save('S-13_Territorio.pdf');
  };

  const territoryKeys = Object.keys(byTerritory).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );

  const renderStatus = a => {
    if (a.validation_result === 'complete') return <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">completo</span>;
    if (a.validation_result === 'partial') return <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">parcial</span>;
    if (a.validation_result === 'not_done') return <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">não feito</span>;
    if (a.status === 'returned') return <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">devolvido</span>;
    return <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">designado</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-semibold text-slate-800">Formulário S-13</h2>
          <p className="text-sm text-slate-500">Registro de Designação de Território</p>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <label htmlFor="s13-start-date" className="input-label text-xs">Data Inicial</label>
            <input
              id="s13-start-date"
              type="date"
              value={startDateFilter}
              onChange={e => setStartDateFilter(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="input text-sm"
            />
          </div>
          <button className="btn btn-primary mt-5" onClick={gerarPDF}>
            <FileText className="w-4 h-4" />
            Gerar PDF
          </button>
        </div>
      </div>

      {territoryKeys.length === 0 ? (
        <div className="card p-6 text-center text-slate-500">Nenhum dado para exibir</div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Território</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Dirigente</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Designação</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Conclusão</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {territoryKeys.map(tKey => {
                const list = byTerritory[tKey]
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.assigned_date || a.created_at) - new Date(b.assigned_date || b.created_at)
                  );
                return (
                  <Fragment key={tKey}>
                    <tr className="bg-slate-50 font-semibold text-slate-700">
                      <td className="px-4 py-2" colSpan={6}>
                        <div className="flex items-center justify-between">
                          <span>Território {tKey}</span>
                          <button
                            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                            title="Lançar manualmente"
                            onClick={() => openCreate(tKey)}
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {list.map((a, idx) => {
                      const isPartial = a.validation_result === 'partial' || a.validation_result === 'not_done';
                      const start = safeDate(a.assigned_date || a.created_at, 'dd/MM/yyyy');
                      const end = isPartial ? '' : safeDate(a.conclusion_date || a.validated_at || a.returned_at, 'dd/MM/yyyy');
                      return (
                        <tr key={`${tKey}-${idx}`} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-800">{tKey}</td>
                          <td className="px-4 py-2 text-slate-700">{a.dirigente_name || '-'}</td>
                          <td className="px-4 py-2 text-slate-700">{start || '-'}</td>
                          <td className="px-4 py-2 text-slate-700">{end || (isPartial ? '' : '-')}</td>
                          <td className="px-4 py-2">{renderStatus(a)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEdit(a)}
                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                                title="Editar registro"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(a)}
                                disabled={deletingId === a.id}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-60"
                                title="Excluir registro"
                              >
                                {deletingId === a.id ? <div className="spinner w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="Editar Registro"
      >
        <form className="space-y-4" onSubmit={submitEdit}>
          <div>
            <label htmlFor="s13-edit-dirigente" className="input-label">Dirigente</label>
            <select
              id="s13-edit-dirigente"
              value={editForm.dirigente_id}
              onChange={e => setEditForm(prev => ({ ...prev, dirigente_id: e.target.value }))}
              className="input"
            >
              <option value="">Selecionar dirigente</option>
              {dirigentes.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="s13-edit-assigned-date" className="input-label">Designação</label>
              <input
                id="s13-edit-assigned-date"
                type="date"
                value={editForm.assigned_date}
                onChange={e => setEditForm(prev => ({ ...prev, assigned_date: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="s13-edit-conclusion-date" className="input-label">Conclusão</label>
              <input
                id="s13-edit-conclusion-date"
                type="date"
                value={editForm.conclusion_date}
                onChange={e => setEditForm(prev => ({ ...prev, conclusion_date: e.target.value }))}
                className="input"
                disabled={editForm.status !== 'complete'}
              />
            </div>
          </div>

          <div>
            <label htmlFor="s13-edit-status" className="input-label">Status</label>
            <select
              id="s13-edit-status"
              value={editForm.status}
              onChange={e => handleStatusChange(e.target.value)}
              className="input"
            >
              <option value="complete">Completo</option>
              <option value="partial">Parcial</option>
              <option value="not_done">Não feito</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditingRecord(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? <div className="spinner" /> : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(creatingTarget)}
        onClose={() => setCreatingTarget(null)}
        title="Lançamento Manual"
      >
        <form className="space-y-4" onSubmit={submitCreate}>
          <div>
            <label htmlFor="s13-create-dirigente" className="input-label">Dirigente</label>
            <select
              id="s13-create-dirigente"
              value={createForm.dirigente_id}
              onChange={e => setCreateForm(prev => ({ ...prev, dirigente_id: e.target.value }))}
              className="input"
            >
              <option value="">Selecionar dirigente</option>
              {dirigentes.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="s13-create-assigned-date" className="input-label">Designação</label>
              <input
                id="s13-create-assigned-date"
                type="date"
                value={createForm.assigned_date}
                onChange={e => setCreateForm(prev => ({ ...prev, assigned_date: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="s13-create-conclusion-date" className="input-label">Conclusão</label>
              <input
                id="s13-create-conclusion-date"
                type="date"
                value={createForm.conclusion_date}
                onChange={e => setCreateForm(prev => ({ ...prev, conclusion_date: e.target.value }))}
                className="input"
                disabled={createForm.status !== 'complete'}
              />
            </div>
          </div>

          <div>
            <label htmlFor="s13-create-status" className="input-label">Status</label>
            <select
              id="s13-create-status"
              value={createForm.status}
              onChange={e => handleCreateStatusChange(e.target.value)}
              className="input"
            >
              <option value="complete">Completo</option>
              <option value="partial">Parcial</option>
              <option value="not_done">Não feito</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setCreatingTarget(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? <div className="spinner" /> : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

S13Form.propTypes = {
  assignments: PropTypes.array,
};
