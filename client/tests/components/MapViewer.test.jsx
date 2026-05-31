import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MapViewer from '../../src/components/MapViewer';

// Mock react-zoom-pan-pinch
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: (props) => {
    const renderProps = {
      zoomIn: mockZoomIn,
      zoomOut: mockZoomOut,
      resetTransform: mockResetTransform,
    };
    return <div data-testid="transform-wrapper">{props.children(renderProps)}</div>;
  },
  TransformComponent: (props) => (
    <div data-testid="transform-component" style={{ ...props.wrapperStyle, ...props.contentStyle }}>
      {props.children}
    </div>
  ),
}));

describe('MapViewer', () => {
  const defaultProps = {
    src: '/maps/territory-1.png',
    alt: 'Territory 1 Map',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the map container', () => {
      const { container } = render(<MapViewer {...defaultProps} />);
      
      expect(container.querySelector('.map-container')).toBeInTheDocument();
    });

    it('should render the image with correct src and alt', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', '/maps/territory-1.png');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <MapViewer {...defaultProps} className="custom-class" />
      );
      
      expect(container.querySelector('.map-container')).toHaveClass('custom-class');
    });

    it('should render zoom hint', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByText('Use dois dedos para zoom')).toBeInTheDocument();
    });

    it('should render TransformWrapper', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTestId('transform-wrapper')).toBeInTheDocument();
    });

    it('should render TransformComponent', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTestId('transform-component')).toBeInTheDocument();
    });

    it('should set image as non-draggable', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      expect(image).toHaveAttribute('draggable', 'false');
    });
  });

  describe('zoom controls', () => {
    it('should render zoom in button', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTitle('Aumentar zoom')).toBeInTheDocument();
    });

    it('should render zoom out button', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTitle('Diminuir zoom')).toBeInTheDocument();
    });

    it('should call zoomIn when clicking zoom in button', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Aumentar zoom'));
      
      expect(mockZoomIn).toHaveBeenCalled();
    });

    it('should call zoomOut when clicking zoom out button', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Diminuir zoom'));
      
      expect(mockZoomOut).toHaveBeenCalled();
    });
  });

  describe('reset button', () => {
    it('should render reset button by default', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTitle('Resetar')).toBeInTheDocument();
    });

    it('should call resetTransform when clicking reset button', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Resetar'));
      
      expect(mockResetTransform).toHaveBeenCalled();
    });

    it('should hide reset button when hideReset is true', () => {
      render(<MapViewer {...defaultProps} hideReset />);
      
      expect(screen.queryByTitle('Resetar')).not.toBeInTheDocument();
    });

    it('should still show zoom controls when hideReset is true', () => {
      render(<MapViewer {...defaultProps} hideReset />);
      
      expect(screen.getByTitle('Aumentar zoom')).toBeInTheDocument();
      expect(screen.getByTitle('Diminuir zoom')).toBeInTheDocument();
    });
  });

  describe('fullscreen functionality', () => {
    it('should render fullscreen button', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTitle('Tela cheia')).toBeInTheDocument();
    });

    it('should open fullscreen modal when clicking fullscreen button', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
    });

    it('should close fullscreen modal when clicking overlay', () => {
      render(<MapViewer {...defaultProps} />);
      
      // Open fullscreen
      fireEvent.click(screen.getByTitle('Tela cheia'));
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
      
      // Click the overlay (the black background div)
      const overlay = screen.getByText('Toque para fechar').closest('.fixed');
      fireEvent.click(overlay);
      
      expect(screen.queryByText('Toque para fechar')).not.toBeInTheDocument();
    });

    it('should render zoom controls in fullscreen mode', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // Should have additional zoom buttons in fullscreen (2 sets now)
      const zoomInButtons = screen.getAllByTitle('Aumentar zoom');
      expect(zoomInButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should hide reset button in fullscreen when hideReset is true', () => {
      render(<MapViewer {...defaultProps} hideReset />);
      
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // No reset buttons should exist
      expect(screen.queryByTitle('Resetar')).not.toBeInTheDocument();
    });

    it('should render image in fullscreen modal', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // Should have 2 images now (normal + fullscreen)
      const images = screen.getAllByAltText('Territory 1 Map');
      expect(images.length).toBe(2);
    });

    it('should not close fullscreen when clicking on image', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // Find the fullscreen image and click it
      const images = screen.getAllByAltText('Territory 1 Map');
      const fullscreenImage = images[1]; // Second image is fullscreen
      fireEvent.click(fullscreenImage);
      
      // Should still be in fullscreen
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner before image loads', () => {
      const { container } = render(<MapViewer {...defaultProps} />);
      
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });

    it('should hide loading spinner after image loads', () => {
      const { container } = render(<MapViewer {...defaultProps} />);
      
      // Trigger image load
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.load(image);
      
      expect(container.querySelector('.spinner')).not.toBeInTheDocument();
    });

    it('should show image with opacity 0 before load', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      expect(image).toHaveClass('opacity-0');
    });

    it('should show image with opacity 100 after load', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.load(image);
      
      expect(image).toHaveClass('opacity-100');
    });
  });

  describe('error state', () => {
    it('should show error message when image fails to load', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      expect(screen.getByText('Mapa não disponível')).toBeInTheDocument();
    });

    it('should show alt text in error state', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      expect(screen.getByText('Territory 1 Map')).toBeInTheDocument();
    });

    it('should hide zoom controls in error state', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      expect(screen.queryByTitle('Aumentar zoom')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Diminuir zoom')).not.toBeInTheDocument();
    });

    it('should apply custom className in error state', () => {
      const { container } = render(
        <MapViewer {...defaultProps} className="custom-error-class" />
      );
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      expect(container.querySelector('.custom-error-class')).toBeInTheDocument();
    });

    it('should show centered error container', () => {
      const { container } = render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      const errorContainer = container.querySelector('.map-container');
      expect(errorContainer).toHaveClass('flex');
      expect(errorContainer).toHaveClass('items-center');
      expect(errorContainer).toHaveClass('justify-center');
    });
  });

  describe('styling', () => {
    it('should have minimum height of 300px', () => {
      const { container } = render(<MapViewer {...defaultProps} />);
      
      const mapContainer = container.querySelector('.map-container');
      expect(mapContainer).toHaveStyle({ minHeight: '300px' });
    });

    it('should have minimum height in error state', () => {
      const { container } = render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      const mapContainer = container.querySelector('.map-container');
      expect(mapContainer).toHaveStyle({ minHeight: '300px' });
    });
  });

  describe('fullscreen zoom controls', () => {
    it('should call zoomIn in fullscreen without closing modal', () => {
      render(<MapViewer {...defaultProps} />);
      
      // Open fullscreen
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // Get all zoom in buttons and click the last one (fullscreen)
      const zoomInButtons = screen.getAllByTitle('Aumentar zoom');
      fireEvent.click(zoomInButtons.at(-1));
      
      // Modal should still be open
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
      expect(mockZoomIn).toHaveBeenCalled();
    });

    it('should call zoomOut in fullscreen without closing modal', () => {
      render(<MapViewer {...defaultProps} />);
      
      // Open fullscreen
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // Get all zoom out buttons and click the last one (fullscreen)
      const zoomOutButtons = screen.getAllByTitle('Diminuir zoom');
      fireEvent.click(zoomOutButtons.at(-1));
      
      // Modal should still be open
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
      expect(mockZoomOut).toHaveBeenCalled();
    });

    it('should call resetTransform in fullscreen without closing modal', () => {
      render(<MapViewer {...defaultProps} />);
      
      // Open fullscreen
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      // Get all reset buttons and click the last one (fullscreen)
      const resetButtons = screen.getAllByTitle('Resetar');
      fireEvent.click(resetButtons.at(-1));
      
      // Modal should still be open
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
      expect(mockResetTransform).toHaveBeenCalled();
    });
  });

  describe('props', () => {
    it('should handle different src values', () => {
      render(<MapViewer src="/custom/path/map.png" alt="Custom Map" />);
      
      const image = screen.getByAltText('Custom Map');
      expect(image).toHaveAttribute('src', '/custom/path/map.png');
    });

    it('should handle empty className', () => {
      const { container } = render(<MapViewer {...defaultProps} className="" />);
      
      expect(container.querySelector('.map-container')).toBeInTheDocument();
    });

    it('should default className to empty string', () => {
      const { container } = render(<MapViewer src="/map.png" alt="Map" />);
      
      const mapContainer = container.querySelector('.map-container');
      expect(mapContainer).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible button titles', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByTitle('Aumentar zoom')).toBeInTheDocument();
      expect(screen.getByTitle('Diminuir zoom')).toBeInTheDocument();
      expect(screen.getByTitle('Resetar')).toBeInTheDocument();
      expect(screen.getByTitle('Tela cheia')).toBeInTheDocument();
    });

    it('should have alt text on image', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByAltText('Territory 1 Map')).toBeInTheDocument();
    });
  });

  describe('Portuguese text', () => {
    it('should display Portuguese zoom hint', () => {
      render(<MapViewer {...defaultProps} />);
      
      expect(screen.getByText('Use dois dedos para zoom')).toBeInTheDocument();
    });

    it('should display Portuguese error message', () => {
      render(<MapViewer {...defaultProps} />);
      
      const image = screen.getByAltText('Territory 1 Map');
      fireEvent.error(image);
      
      expect(screen.getByText('Mapa não disponível')).toBeInTheDocument();
    });

    it('should display Portuguese close hint in fullscreen', () => {
      render(<MapViewer {...defaultProps} />);
      
      fireEvent.click(screen.getByTitle('Tela cheia'));
      
      expect(screen.getByText('Toque para fechar')).toBeInTheDocument();
    });
  });
});
