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

  // Manage streets and houses state
  const [showManageStreetsModal, setShowManageStreetsModal] = useState(false);
  const [selectedTerritoryForStreets, setSelectedTerritoryForStreets] = useState(null);
  const [streets, setStreets] = useState([]);
  const [newStreetName, setNewStreetName] = useState('');
  const [newStreetBlock, setNewStreetBlock] = useState(1);
  const [selectedStreetForHouse, setSelectedStreetForHouse] = useState('');
  const [newHouseNumber, setNewHouseNumber] = useState('');
  const [newHouseDontVisit, setNewHouseDontVisit] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);
  const [editingStreetIdForFields, setEditingStreetIdForFields] = useState(null);
  const [editStreetName, setEditStreetName] = useState('');
  const [editStreetBlock, setEditStreetBlock] = useState(1);
  const [editStreetObs, setEditStreetObs] = useState('');
  const [editingHouseId, setEditingHouseId] = useState(null);
  const [editHouseNumber, setEditHouseNumber] = useState('');

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

  const fetchStreets = async (territoryId) => {
    setLoadingStreets(true);
    try {
      const response = await api.get(`/territories/${territoryId}/streets`);
      setStreets(response.data);
    } catch (error) {
      console.error('Fetch streets error:', error);
      toast.error('Erro ao carregar ruas e casas');
    } finally {
      setLoadingStreets(false);
    }
  };

  const handleOpenManageStreets = (territory) => {
    setSelectedTerritoryForStreets(territory);
    setNewStreetName('');
    setNewStreetBlock(1);
    setSelectedStreetForHouse('');
    setNewHouseNumber('');
    setNewHouseDontVisit(false);
    setEditingStreetIdForFields(null);
    setEditingHouseId(null);
    fetchStreets(territory.id);
    setShowManageStreetsModal(true);
  };

  const handleAddStreet = async (e) => {
    e.preventDefault();
    if (!newStreetName.trim() || !newStreetBlock || !selectedTerritoryForStreets) return;
    try {
      await api.post(`/territories/${selectedTerritoryForStreets.id}/streets`, {
        name: newStreetName,
        block_number: newStreetBlock
      });
      toast.success('Rua adicionada com sucesso!');
      setNewStreetName('');
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error('Erro ao adicionar rua');
    }
  };

  const handleDeleteStreet = async (streetId) => {
    if (!confirm('Deseja realmente excluir esta rua? Todas as casas associadas também serão excluídas.')) return;
    try {
      await api.delete(`/territories/streets/${streetId}`);
      toast.success('Rua excluída com sucesso!');
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error('Erro ao excluir rua');
    }
  };

  const handleAddHouse = async (e) => {
    e.preventDefault();
    if (!newHouseNumber.trim() || !selectedStreetForHouse || !selectedTerritoryForStreets) return;
    try {
      await api.post(`/territories/streets/${selectedStreetForHouse}/houses`, {
        number: newHouseNumber,
        dont_visit: newHouseDontVisit
      });
      toast.success('Casa adicionada com sucesso!');
      setNewHouseNumber('');
      setNewHouseDontVisit(false);
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao adicionar casa');
    }
  };

  const handleToggleDontVisit = async (houseId, currentDontVisit) => {
    try {
      await api.put(`/territories/streets/houses/${houseId}`, {
        dont_visit: !currentDontVisit
      });
      toast.success('Status da casa atualizado com sucesso!');
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error('Erro ao atualizar status da casa');
    }
  };

  const handleDeleteHouse = async (houseId) => {
    if (!confirm('Deseja realmente excluir esta casa?')) return;
    try {
      await api.delete(`/territories/streets/houses/${houseId}`);
      toast.success('Casa excluída com sucesso!');
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error('Erro ao excluir casa');
    }
  };

  const startEditingStreetFields = (street) => {
    setEditingStreetIdForFields(street.id);
    setEditStreetName(street.name);
    setEditStreetBlock(street.block);
    setEditStreetObs(street.observations || '');
  };

  const handleSaveStreetFields = async (streetId) => {
    if (!editStreetName.trim() || !editStreetBlock) return;
    try {
      await api.put(`/territories/streets/${streetId}`, {
        name: editStreetName,
        block_number: editStreetBlock,
        observations: editStreetObs
      });
      toast.success('Rua atualizada com sucesso!');
      setEditingStreetIdForFields(null);
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar rua');
    }
  };

  const handleSaveHouseNumber = async (houseId) => {
    if (!editHouseNumber.trim()) {
      setEditingHouseId(null);
      return;
    }
    try {
      await api.put(`/territories/streets/houses/${houseId}`, {
        number: editHouseNumber
      });
      toast.success('Número da casa atualizado com sucesso!');
      setEditingHouseId(null);
      fetchStreets(selectedTerritoryForStreets.id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar número da casa');
    }
  };

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

      const response = await api.post('/territories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Território criado com sucesso!');
      setShowCreateModal(false);
      fetchTerritories();
      fetchPngFiles();

      if (response.data && response.data.id) {
        handleOpenManageStreets(response.data);
      }
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

              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => openViewModal(territory)}
                  className="btn btn-secondary text-xs py-2 flex items-center justify-center gap-1 col-span-2"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver
                </button>
                <button
                  onClick={() => openEditModal(territory)}
                  className="btn btn-secondary text-xs py-2 flex items-center justify-center gap-1 col-span-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleOpenManageStreets(territory)}
                  className="btn btn-secondary text-xs py-2 flex items-center justify-center gap-1 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30 col-span-3"
                >
                  <Grid className="w-3.5 h-3.5" />
                  Ruas/Casas
                </button>
                <button
                  onClick={() => openDeleteModal(territory)}
                  className="btn btn-secondary text-xs py-2 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 col-span-1"
                  disabled={territory.is_assigned}
                  title={territory.is_assigned ? 'Não é possível excluir território designado' : 'Excluir território'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                handleOpenManageStreets(selectedTerritory);
              }}
              className="btn btn-secondary flex items-center justify-center gap-2 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30"
            >
              <Grid className="w-4 h-4" />
              Gerenciar Ruas e Casas deste Território
            </button>
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

      {/* Manage Streets and Houses Modal (Admin only) */}
      <Modal
        isOpen={showManageStreetsModal}
        onClose={() => setShowManageStreetsModal(false)}
        title={selectedTerritoryForStreets ? `Gerenciar Ruas e Casas - Território ${selectedTerritoryForStreets.territory_number}` : 'Gerenciar Ruas e Casas'}
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Add Street Form */}
          <form onSubmit={handleAddStreet} className="card p-4 space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Adicionar Nova Rua</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={newStreetName}
                  onChange={(e) => setNewStreetName(e.target.value)}
                  placeholder="Nome da Rua (Ex: Rua das Flores)"
                  className="input"
                  required
                />
              </div>
              <div>
                <select
                  value={newStreetBlock}
                  onChange={(e) => setNewStreetBlock(Number(e.target.value))}
                  className="input"
                  required
                >
                  {selectedTerritoryForStreets && Array.from({ length: selectedTerritoryForStreets.block_count }, (_, i) => i + 1).map(b => (
                    <option key={b} value={b}>Quadra {b}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Rua
            </button>
          </form>

          {/* Add House Form */}
          {(() => {
            const uniqueStreets = [];
            const seen = new Set();
            for (const s of streets) {
              if (s.street_id && !seen.has(s.street_id)) {
                seen.add(s.street_id);
                uniqueStreets.push({ id: s.street_id, name: s.street_name, block: s.block_number });
              }
            }

            return uniqueStreets.length > 0 ? (
              <form onSubmit={handleAddHouse} className="card p-4 space-y-4">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Adicionar Número de Casa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <select
                      value={selectedStreetForHouse}
                      onChange={(e) => setSelectedStreetForHouse(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Selecione a rua...</option>
                      {uniqueStreets.sort((a,b) => a.block - b.block || a.name.localeCompare(b.name)).map(s => (
                        <option key={s.id} value={s.id}>Q{s.block} - {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newHouseNumber}
                      onChange={(e) => setNewHouseNumber(e.target.value)}
                      placeholder="Nº (Ex: 123A)"
                      className="input"
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newHouseDontVisit}
                      onChange={(e) => setNewHouseDontVisit(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Marcar como "Não Bater/Visitar"
                    </span>
                  </label>
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-semibold">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Casa
                </button>
              </form>
            ) : null;
          })()}

          {/* Current Streets & Houses List */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Ruas e Casas Cadastradas</h3>
            {loadingStreets ? (
              <div className="flex justify-center py-4">
                <div className="spinner" />
              </div>
            ) : (() => {
              const groupedStreets = {};
              for (const s of streets) {
                if (s.street_id) {
                  if (!groupedStreets[s.street_id]) {
                    groupedStreets[s.street_id] = {
                      id: s.street_id,
                      name: s.street_name,
                      block: s.block_number,
                      observations: s.street_observations,
                      houses: []
                    };
                  }
                  if (s.house_id) {
                    groupedStreets[s.street_id].houses.push({ id: s.house_id, number: s.house_number, dont_visit: s.dont_visit });
                  }
                }
              }

              const streetList = Object.values(groupedStreets).sort((a, b) => a.block - b.block || a.name.localeCompare(b.name));

              if (streetList.length === 0) {
                return <p className="text-xs text-slate-400 text-center py-4">Nenhuma rua cadastrada ainda.</p>;
              }

              return (
                <div className="space-y-3">
                  {streetList.map(street => (
                    <div key={street.id} className="border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
                      {editingStreetIdForFields === street.id ? (
                        <div className="flex flex-col gap-2 w-full p-2 bg-slate-50 dark:bg-slate-800/20 rounded-lg">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Nome da Rua</label>
                              <input
                                type="text"
                                value={editStreetName}
                                onChange={(e) => setEditStreetName(e.target.value)}
                                className="input py-1 px-2.5 text-xs w-full"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Quadra</label>
                              <select
                                value={editStreetBlock}
                                onChange={(e) => setEditStreetBlock(Number(e.target.value))}
                                className="input py-1 px-2.5 text-xs w-full"
                              >
                                {Array.from({ length: selectedTerritoryForStreets.block_count }, (_, i) => i + 1).map(b => (
                                  <option key={b} value={b}>Quadra {b}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Observações</label>
                              <input
                                type="text"
                                value={editStreetObs}
                                onChange={(e) => setEditStreetObs(e.target.value)}
                                className="input py-1 px-2.5 text-xs w-full"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveStreetFields(street.id)}
                              className="btn btn-primary py-0.5 px-2.5 text-[10px]"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStreetIdForFields(null)}
                              className="btn btn-secondary py-0.5 px-2.5 text-[10px]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/20 p-2 rounded-lg">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Quadra {street.block} - {street.name}
                            </span>
                            {street.observations && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                Obs: {street.observations}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditingStreetFields(street)}
                              className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-colors"
                              title="Editar rua"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStreet(street.id)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 px-1">
                        {street.houses.length === 0 ? (
                          <span className="text-xs text-slate-400">Nenhuma casa adicionada.</span>
                        ) : (
                          street.houses.map(house => (
                            <span
                              key={house.id}
                              className={`inline-flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg border transition-colors ${
                                house.dont_visit
                                  ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-300'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {editingHouseId === house.id ? (
                                <input
                                  type="text"
                                  value={editHouseNumber}
                                  onChange={(e) => setEditHouseNumber(e.target.value)}
                                  onBlur={() => handleSaveHouseNumber(house.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveHouseNumber(house.id);
                                    if (e.key === 'Escape') setEditingHouseId(null);
                                  }}
                                  className="w-12 py-0 px-1 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-800 dark:text-white"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span 
                                    onClick={() => handleToggleDontVisit(house.id, house.dont_visit)}
                                    className="cursor-pointer hover:underline"
                                    title="Clique para alternar status Não Visitar"
                                  >
                                    Nº {house.number} {house.dont_visit && '(Não Visitar)'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingHouseId(house.id);
                                      setEditHouseNumber(house.number);
                                    }}
                                    className="text-indigo-500 hover:text-indigo-700 ml-1 font-bold text-xs"
                                    title="Editar número da casa"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteHouse(house.id)}
                                    className="text-red-500 hover:text-red-700 ml-1 font-bold text-sm"
                                  >
                                    &times;
                                  </button>
                                </>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        <div className="pt-4 border-t">
          <button
            onClick={() => setShowManageStreetsModal(false)}
            className="btn btn-secondary w-full"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default AdminTerritories;
