import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import MapViewer from '../components/MapViewer';
import { LayoutGrid, Map } from 'lucide-react';

function GeneralMaps() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMap, setSelectedMap] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    try {
      const response = await api.get('/maps/general');
      console.log('General maps response:', response.data);
      setMaps(response.data.maps || []);
      if (response.data.maps && response.data.maps.length > 0) {
        setSelectedMap(response.data.maps[0]);
      }
    } catch (error) {
      console.error('Error fetching general maps:', error);
      toast.error('Erro ao carregar mapas gerais');
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-2xl font-display font-bold text-slate-800">Mapas Gerais</h1>
        <p className="text-slate-500 text-sm mt-1">
          Visão geral dos territórios da congregação
        </p>
      </div>

      {/* Map Selector */}
      {maps.length > 1 && (
        <div className="flex gap-2">
          {maps.map((map, index) => (
            <button
              key={map.filename}
              onClick={() => setSelectedMap(map)}
              className={`btn ${selectedMap?.filename === map.filename ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Map className="w-4 h-4" />
              Mapa Geral {index + 1}
            </button>
          ))}
        </div>
      )}

      {/* Map Viewer */}
      {selectedMap ? (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary-600" />
              {selectedMap.filename.replace('.png', '').replace('ter_', 'Território ')}
            </h2>
          </div>
          <MapViewer
            src={selectedMap.url}
            alt={`Mapa geral - ${selectedMap.filename}`}
            className="h-[600px]"
          />
        </div>
      ) : (
        <div className="card p-12 text-center">
          <LayoutGrid className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">
            Mapas Gerais não encontrados
          </h3>
          <p className="text-slate-400 text-sm">
            Adicione os arquivos ter_geral1.png e ter_geral2.png na pasta png_files
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="card p-5 bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-800 mb-2">💡 Dica</h3>
        <p className="text-sm text-primary-700">
          Use os controles de zoom para visualizar melhor os detalhes do mapa. 
          No celular, use dois dedos para ampliar e mover o mapa. 
          Clique no botão de tela cheia para uma visualização maior.
        </p>
      </div>
    </div>
  );
}

export default GeneralMaps;
