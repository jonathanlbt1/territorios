import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import MapViewer from '../../components/MapViewer';
import { getMapUrl } from '../../utils/mapUrl';
import EmptyState from '../../components/EmptyState';
import {
  MapPin,
  Search,
  Eye,
  Edit2,
  Calendar,
  Grid,
  Plus,
  Trash2,
  Upload,
  Image,
  FileImage,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function AdminTerritories() {
  const [territories, setTerritories] = useState([]);
  const [pngFiles, setPngFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const toast = useToast();

  // Create form state
  const [createForm, setCreateForm] = useState({
    territory_number: '',
    locality: '',
    block_count: '4',
    observations: '',
    map_filename: ''
  });
  const [createFile, setCreateFile] = useState(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    locality: '',
    block_count: '',
    observations: '',
    map_filename: ''
  });
  const [editFile, setEditFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTerritories();
    fetchPngFiles();
  }, []);

  const fetchTerritories = async () => {
    try {
      const response = await api.get('/territories');
      setTerritories(response.data);
    } catch (error) {
      console.error('Fetch territories error:', error);
      toast.error('Erro ao carregar territórios');
    } finally {
      setLoading(false);
    }
  };

  const fetchPngFiles = async () => {
    try {
      const response = await api.get('/territories/png-files');
      setPngFiles(response.data);
    } catch (error) {
      console.error('Erro ao carregar arquivos PNG:', error);
    }
  };

  // Get PNG files that are not in use by any territory
  const getAvailablePngFiles = (currentFilename = null) => {
    const usedFilenames = new Set(territories.map(t => t.map_filename));
    return pngFiles.filter(file => 
      !usedFilenames.has(file) || file === currentFilename
    );
  };

  const openViewModal = (territory) => {
    setSelectedTerritory(territory);
    setShowViewModal(true);
  };

  const openEditModal = (territory) => {
    setSelectedTerritory(territory);
    setEditForm({
      locality: territory.locality,
      block_count: territory.block_count.toString(),
      observations: territory.observations || '',
      map_filename: territory.map_filename || ''
    });
    setEditFile(null);
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setCreateForm({
      territory_number: '',
      locality: '',
      block_count: '4',
      observations: '',
      map_filename: ''
    });
    setCreateFile(null);
    setShowCreateModal(true);
  };

  const openDeleteModal = (territory) => {
    setSelectedTerritory(territory);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!createForm.territory_number || !createForm.locality || !createForm.block_count) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!createForm.map_filename && !createFile) {
      toast.error('Selecione um arquivo de mapa existente ou faça upload de um novo');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('territory_number', createForm.territory_number);
      formData.append('locality', createForm.locality);
      formData.append('block_count', createForm.block_count);
      formData.append('observations', createForm.observations);
      
      if (createFile) {
        // Rename file to match territory pattern
        const newFilename = `ter_${createForm.territory_number}.png`;
        formData.append('map_file', createFile, newFilename);
        formData.append('filename', newFilename);
      } else {
        formData.append('map_filename', createForm.map_filename);
      }

      await api.post('/territories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Território criado com sucesso!');
      setShowCreateModal(false);
      fetchTerritories();
      fetchPngFiles();
    } catch (error) {
      console.error('Create territory error:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar território');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('locality', editForm.locality);
      formData.append('block_count', editForm.block_count);
      formData.append('observations', editForm.observations);
      
      if (editFile) {
        formData.append('map_file', editFile);
      } else if (editForm.map_filename) {
        formData.append('map_filename', editForm.map_filename);
      }

      await api.put(`/territories/${selectedTerritory.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Território atualizado com sucesso!');
      setShowEditModal(false);
      fetchTerritories();
    } catch (error) {
      console.error('Update territory error:', error);
      toast.error('Erro ao atualizar território');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTerritory) return;
    
    setDeleting(true);
    try {
      await api.delete(`/territories/${selectedTerritory.id}`);
      toast.success('Território excluído com sucesso!');
      setShowDeleteModal(false);
      setSelectedTerritory(null);
      fetchTerritories();
    } catch (error) {
      console.error('Delete territory error:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir território');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTerritories = territories.filter(t =>
    t.territory_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.locality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.territory_number.toString().includes(searchTerm)
  );

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Territórios</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {territories.length} territórios cadastrados
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          Novo Território
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por número, código ou localidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input !pl-12"
        />
      </div>

      {/* Territories Grid */}
      {filteredTerritories.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nenhum território encontrado"
          description="Ajuste sua busca ou crie um novo território"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTerritories.map(territory => (
            <div
              key={territory.id}
              className="card p-4 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="territory-number">
                  {territory.territory_number}
                </div>
                {territory.is_assigned && (
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-lg font-medium">
                    Designado
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-slate-800 dark:text-white mb-1 truncate">
                Território: {territory.territory_number}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-3">{territory.locality}</p>

              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                <Grid className="w-3.5 h-3.5" />
                <span>{territory.block_count} quadras</span>
              </div>

              {territory.last_worked_date && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Último: {formatDistanceToNow(parseISO(territory.last_worked_date), { 
                      addSuffix: true,
                      locale: ptBR 
                    })}
                  </span>
                </div>
              )}

              {!territory.last_worked_date && (
                <div className="flex items-center gap-2 text-xs text-amber-500 dark:text-amber-400 mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Nunca trabalhado</span>
                </div>
              )}

              {territory.observations && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mb-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Observações:</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                    {territory.observations}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => openViewModal(territory)}
                  className="btn btn-secondary flex-1 text-xs py-2"
                >
                  <Eye className="w-4 h-4" />
                  Ver
                </button>
                <button
                  onClick={() => openEditModal(territory)}
                  className="btn btn-secondary flex-1 text-xs py-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => openDeleteModal(territory)}
                  className="btn btn-secondary text-xs py-2 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  disabled={territory.is_assigned}
                  title={territory.is_assigned ? 'Não é possível excluir território designado' : 'Excluir território'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Territory Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Território ${selectedTerritory?.territory_number}`}
        size="lg"
      >
        {selectedTerritory && (
          <div className="space-y-6">
            <MapViewer
              src={getMapUrl(selectedTerritory.map_filename)}
              alt={`Mapa do território ${selectedTerritory.territory_code}`}
              className="h-[400px] rounded-xl"
              hideReset={true}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Localidade</p>
                <p className="font-medium text-slate-800 dark:text-white">{selectedTerritory.locality}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Quadras</p>
                <p className="font-medium text-slate-800 dark:text-white">{selectedTerritory.block_count}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Último Trabalho</p>
                <p className="font-medium text-slate-800 dark:text-white">
                  {selectedTerritory.last_worked_date 
                    ? format(parseISO(selectedTerritory.last_worked_date), "dd/MM/yyyy", { locale: ptBR })
                    : 'Nunca trabalhado'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                <p className={`font-medium ${selectedTerritory.is_assigned ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {selectedTerritory.is_assigned ? 'Designado' : 'Disponível'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">Arquivo do Mapa</p>
                <p className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                  <FileImage className="w-4 h-4" />
                  {selectedTerritory.map_filename || 'Não definido'}
                </p>
              </div>
            </div>

            {selectedTerritory.observations && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Observações</p>
                <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl text-sm">
                  {selectedTerritory.observations}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Territory Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Novo Território"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-territory-number" className="input-label">Número do Território *</label>
              <input
                id="create-territory-number"
                type="number"
                min="1"
                value={createForm.territory_number}
                onChange={(e) => setCreateForm({ ...createForm, territory_number: e.target.value })}
                className="input"
                placeholder="Ex: 42"
                required
              />
            </div>
            <div>
              <label htmlFor="create-block-count" className="input-label">Quantidade de Quadras *</label>
              <input
                id="create-block-count"
                type="number"
                min="1"
                max="20"
                value={createForm.block_count}
                onChange={(e) => setCreateForm({ ...createForm, block_count: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="create-locality" className="input-label">Localidade *</label>
            <input
              id="create-locality"
              type="text"
              value={createForm.locality}
              onChange={(e) => setCreateForm({ ...createForm, locality: e.target.value })}
              className="input"
              placeholder="Ex: Centro, Vila Nova, etc."
              required
            />
          </div>

          <div>
            <label htmlFor="create-map-filename" className="input-label">Mapa do Território *</label>
            <div className="space-y-3">
              {/* Select existing file */}
              <div>
                <label htmlFor="create-map-filename" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  Selecionar arquivo existente:
                </label>
                <select
                  id="create-map-filename"
                  value={createForm.map_filename}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, map_filename: e.target.value });
                    if (e.target.value) setCreateFile(null);
                  }}
                  className="input"
                  disabled={createFile !== null}
                >
                  <option value="">-- Selecione um arquivo --</option>
                  {getAvailablePngFiles().map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
                <span className="text-xs text-slate-400">ou</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              {/* Upload new file */}
              <div>
                <label htmlFor="create-map-file-upload" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  Fazer upload de novo arquivo:
                </label>
                <label htmlFor="create-map-file-upload" className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                  <input
                    id="create-map-file-upload"
                    type="file"
                    accept="image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCreateFile(file);
                        setCreateForm({ ...createForm, map_filename: '' });
                      }
                    }}
                    className="hidden"
                  />
                  {createFile ? (
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                      <Image className="w-5 h-5" />
                      <span className="text-sm font-medium">{createFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Clique para selecionar arquivo PNG</span>
                    </div>
                  )}
                </label>
                {createFile && (
                  <button
                    type="button"
                    onClick={() => setCreateFile(null)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remover arquivo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="create-observations" className="input-label">Observações</label>
            <textarea
              id="create-observations"
              value={createForm.observations}
              onChange={(e) => setCreateForm({ ...createForm, observations: e.target.value })}
              className="input min-h-[80px] resize-none"
              placeholder="Observações sobre o território..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <div className="spinner" /> : (
                <>
                  <Plus className="w-5 h-5" />
                  Criar Território
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Territory Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Editar Território ${selectedTerritory?.territory_number}`}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label htmlFor="edit-locality" className="input-label">Localidade</label>
            <input
              id="edit-locality"
              type="text"
              value={editForm.locality}
              onChange={(e) => setEditForm({ ...editForm, locality: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-block-count" className="input-label">Quantidade de Quadras</label>
            <input
              id="edit-block-count"
              type="number"
              min="1"
              max="20"
              value={editForm.block_count}
              onChange={(e) => setEditForm({ ...editForm, block_count: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-map-filename" className="input-label">Arquivo do Mapa</label>
            <div className="space-y-3">
              {/* Current file */}
              {selectedTerritory?.map_filename && !editFile && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <FileImage className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Atual: {selectedTerritory.map_filename}
                  </span>
                </div>
              )}

              {/* Select different file */}
              <div>
                <label htmlFor="edit-map-filename" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  Trocar para arquivo existente:
                </label>
                <select
                  id="edit-map-filename"
                  value={editForm.map_filename}
                  onChange={(e) => {
                    setEditForm({ ...editForm, map_filename: e.target.value });
                    if (e.target.value) setEditFile(null);
                  }}
                  className="input"
                  disabled={editFile !== null}
                >
                  <option value="">-- Manter atual --</option>
                  {getAvailablePngFiles(selectedTerritory?.map_filename).map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
                <span className="text-xs text-slate-400">ou</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              {/* Upload new file */}
              <div>
                <label htmlFor="edit-map-file-upload" className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  Fazer upload de novo arquivo:
                </label>
                <label htmlFor="edit-map-file-upload" className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                  <input
                    id="edit-map-file-upload"
                    type="file"
                    accept="image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEditFile(file);
                        setEditForm({ ...editForm, map_filename: '' });
                      }
                    }}
                    className="hidden"
                  />
                  {editFile ? (
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                      <Image className="w-5 h-5" />
                      <span className="text-sm font-medium">{editFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Clique para selecionar arquivo PNG</span>
                    </div>
                  )}
                </label>
                {editFile && (
                  <button
                    type="button"
                    onClick={() => setEditFile(null)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remover arquivo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="edit-observations" className="input-label">Observações</label>
            <textarea
              id="edit-observations"
              value={editForm.observations}
              onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
              className="input min-h-[100px] resize-none"
              placeholder="Observações sobre o território..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <div className="spinner" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Excluir Território"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">
                Tem certeza que deseja excluir?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                O território <strong>{selectedTerritory?.territory_number}</strong> ({selectedTerritory?.locality}) 
                será excluído permanentemente, junto com todo o seu histórico.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="btn btn-secondary flex-1"
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
            >
              {deleting ? <div className="spinner" /> : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Excluir
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminTerritories;
