import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mocks with vi.hoisted
const { mockApi, mockToast } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/services/api', () => ({
  default: mockApi,
}));

vi.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  LayoutGrid: (props) => <svg data-testid="layout-grid-icon" {...props} />,
  Map: (props) => <svg data-testid="map-icon" {...props} />,
}));

// Mock MapViewer component
vi.mock('../../src/components/MapViewer', () => ({
  default: ({ src, alt, className }) => (
    <div data-testid="map-viewer" data-src={src} data-alt={alt} className={className}>
      MapViewer: {alt}
    </div>
  ),
}));

import GeneralMaps from '../../src/pages/GeneralMaps';

const createMockMaps = (count = 2) => {
  const maps = [];
  for (let i = 1; i <= count; i++) {
    maps.push({
      filename: `ter_geral${i}.png`,
      url: `/api/maps/ter_geral${i}.png`,
    });
  }
  return maps;
};

describe('GeneralMaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockResolvedValue({ data: { maps: createMockMaps(2) } });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {}));
      render(<GeneralMaps />);
      expect(document.querySelector('.spinner')).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(document.querySelector('.spinner')).not.toBeInTheDocument();
      });
    });
  });

  describe('data fetching', () => {
    it('should fetch general maps on mount', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/maps/general');
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar mapas gerais');
      });
    });

    it('should handle empty maps array', async () => {
      mockApi.get.mockResolvedValue({ data: { maps: [] } });
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais não encontrados')).toBeInTheDocument();
      });
    });

    it('should handle undefined maps response', async () => {
      mockApi.get.mockResolvedValue({ data: {} });
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais não encontrados')).toBeInTheDocument();
      });
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais')).toBeInTheDocument();
      });
    });

    it('should render page description', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Visão geral dos territórios da congregação')).toBeInTheDocument();
      });
    });
  });

  describe('map selector', () => {
    it('should show map selector buttons when multiple maps exist', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapa Geral 1')).toBeInTheDocument();
        expect(screen.getByText('Mapa Geral 2')).toBeInTheDocument();
      });
    });

    it('should not show map selector when only one map exists', async () => {
      mockApi.get.mockResolvedValue({ data: { maps: createMockMaps(1) } });
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.queryByText('Mapa Geral 1')).not.toBeInTheDocument();
      });
    });

    it('should select first map by default', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        const mapViewer = screen.getByTestId('map-viewer');
        expect(mapViewer).toHaveAttribute('data-src', '/api/maps/ter_geral1.png');
      });
    });

    it('should change selected map when button is clicked', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapa Geral 2')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Mapa Geral 2'));
      
      const mapViewer = screen.getByTestId('map-viewer');
      expect(mapViewer).toHaveAttribute('data-src', '/api/maps/ter_geral2.png');
    });

    it('should highlight selected map button', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapa Geral 1')).toBeInTheDocument();
      });
      
      const button1 = screen.getByText('Mapa Geral 1').closest('button');
      const button2 = screen.getByText('Mapa Geral 2').closest('button');
      
      // First button should have primary style (selected)
      expect(button1).toHaveClass('btn-primary');
      expect(button2).toHaveClass('btn-secondary');
      
      // Click second button
      fireEvent.click(button2);
      
      // Now second should be primary
      expect(button1).toHaveClass('btn-secondary');
      expect(button2).toHaveClass('btn-primary');
    });

    it('should render map icon in selector buttons', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        const mapIcons = screen.getAllByTestId('map-icon');
        expect(mapIcons.length).toBe(2);
      });
    });
  });

  describe('map viewer', () => {
    it('should render MapViewer component when map is selected', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });
    });

    it('should pass correct src to MapViewer', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        const mapViewer = screen.getByTestId('map-viewer');
        expect(mapViewer).toHaveAttribute('data-src', '/api/maps/ter_geral1.png');
      });
    });

    it('should pass correct alt text to MapViewer', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        const mapViewer = screen.getByTestId('map-viewer');
        expect(mapViewer).toHaveAttribute('data-alt', 'Mapa geral - ter_geral1.png');
      });
    });

    it('should show map title from filename', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          maps: [{ filename: 'ter_geral1.png', url: '/api/maps/ter_geral1.png' }],
        },
      });
      render(<GeneralMaps />);
      await waitFor(() => {
        // ter_geral1.png -> Território geral1 (after replacing ter_ and .png)
        expect(screen.getByText('Território geral1')).toBeInTheDocument();
      });
    });

    it('should render layout grid icon in map header', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByTestId('layout-grid-icon')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue({ data: { maps: [] } });
    });

    it('should show empty state when no maps', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais não encontrados')).toBeInTheDocument();
      });
    });

    it('should show instruction to add map files', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText(/Adicione os arquivos ter_geral1.png e ter_geral2.png/)).toBeInTheDocument();
      });
    });

    it('should show layout grid icon in empty state', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        const icons = screen.getAllByTestId('layout-grid-icon');
        expect(icons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should not render MapViewer when no maps', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.queryByTestId('map-viewer')).not.toBeInTheDocument();
      });
    });
  });

  describe('instructions section', () => {
    it('should render tip header', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('💡 Dica')).toBeInTheDocument();
      });
    });

    it('should render zoom instructions', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText(/Use os controles de zoom/)).toBeInTheDocument();
      });
    });

    it('should render mobile instructions', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText(/No celular, use dois dedos/)).toBeInTheDocument();
      });
    });

    it('should render fullscreen instructions', async () => {
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText(/Clique no botão de tela cheia/)).toBeInTheDocument();
      });
    });
  });

  describe('multiple maps handling', () => {
    it('should handle three or more maps', async () => {
      mockApi.get.mockResolvedValue({ data: { maps: createMockMaps(3) } });
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapa Geral 1')).toBeInTheDocument();
        expect(screen.getByText('Mapa Geral 2')).toBeInTheDocument();
        expect(screen.getByText('Mapa Geral 3')).toBeInTheDocument();
      });
    });

    it('should be able to switch between multiple maps', async () => {
      mockApi.get.mockResolvedValue({ data: { maps: createMockMaps(3) } });
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapa Geral 3')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Mapa Geral 3'));
      
      const mapViewer = screen.getByTestId('map-viewer');
      expect(mapViewer).toHaveAttribute('data-src', '/api/maps/ter_geral3.png');
    });
  });

  describe('edge cases', () => {
    it('should handle null maps response gracefully', async () => {
      mockApi.get.mockResolvedValue({ data: { maps: null } });
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais não encontrados')).toBeInTheDocument();
      });
    });

    it('should still render after fetch error', async () => {
      mockApi.get.mockRejectedValue(new Error('Server error'));
      render(<GeneralMaps />);
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais')).toBeInTheDocument();
        expect(screen.getByText('Mapas Gerais não encontrados')).toBeInTheDocument();
      });
    });
  });
});
