import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { useState } from 'react';

function MapViewer({ src, alt, className = '', hideReset = false }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (imageError) {
    return (
      <div className={`map-container flex items-center justify-center bg-slate-100 ${className}`} style={{ minHeight: '300px' }}>
        <div className="text-center text-slate-500">
          <p className="mb-2">Mapa não disponível</p>
          <p className="text-sm text-slate-400">{alt}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`map-container ${className}`} style={{ minHeight: '300px' }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={8}
          centerOnInit
          wheel={{ step: 0.1 }}
          pinch={{ step: 5 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controls */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                <button
                  onClick={() => zoomIn()}
                  className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-5 h-5 text-slate-700" />
                </button>
                <button
                  onClick={() => zoomOut()}
                  className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="w-5 h-5 text-slate-700" />
                </button>
                {!hideReset && (
                  <button
                    onClick={() => resetTransform()}
                    className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                    title="Resetar"
                  >
                    <RotateCcw className="w-5 h-5 text-slate-700" />
                  </button>
                )}
                <button
                  onClick={toggleFullscreen}
                  className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                  title="Tela cheia"
                >
                  <Maximize2 className="w-5 h-5 text-slate-700" />
                </button>
              </div>

              {/* Loading indicator */}
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                  <div className="spinner" />
                </div>
              )}

              {/* Map image */}
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%', minHeight: '300px' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img
                  src={src}
                  alt={alt}
                  className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  draggable={false}
                />
              </TransformComponent>

              {/* Zoom hint */}
              <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/50 backdrop-blur text-white text-xs rounded-lg">
                Use dois dedos para zoom
              </div>
            </>
          )}
        </TransformWrapper>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black" onClick={toggleFullscreen}>
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={10}
            centerOnInit
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                    className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <ZoomIn className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                    className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <ZoomOut className="w-6 h-6 text-white" />
                  </button>
                  {!hideReset && (
                    <button
                      onClick={(e) => { e.stopPropagation(); resetTransform(); }}
                      className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <RotateCcw className="w-6 h-6 text-white" />
                    </button>
                  )}
                </div>

                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img
                    src={src}
                    alt={alt}
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                    draggable={false}
                  />
                </TransformComponent>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/20 backdrop-blur text-white text-sm rounded-xl">
                  Toque para fechar
                </div>
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </>
  );
}

export default MapViewer;

