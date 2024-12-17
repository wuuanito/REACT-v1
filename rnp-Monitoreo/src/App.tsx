// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Sidebar from './components/Sidebar';
import Sala27 from './pages/Sala27';
import Softgel from './pages/Softgel';
import Produccion from './pages/Produccion';
import Ponderales from './pages/Ponderales';
import Osmosis from './pages/Osmosis';
import './styles/App.scss';
import { Activity, ArrowRight } from 'lucide-react';

// Configuración del cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

interface HomePageProps {}

const HomePage: React.FC<HomePageProps> = () => {
  return (
    <div className="home-page p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-full mb-6">
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Bienvenido al Panel de Control
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Sistema centralizado de monitoreo y control industrial
          </p>
          <div className="h-1 w-20 bg-blue-600 mx-auto"></div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Estado del Sistema</p>
              <p className="text-lg font-medium text-green-600">Operativo</p>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Secciones Activas</p>
              <p className="text-lg font-medium text-gray-900">5/5</p>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Última Actualización</p>
              <p className="text-lg font-medium text-gray-900">Hace 5 min</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Instrucciones
              </h2>
              <p className="text-gray-600">
                Seleccione una sección del menú lateral para comenzar a monitorear y controlar los sistemas
              </p>
            </div>
            <ArrowRight className="h-6 w-6 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
    };

    // Establecer estado inicial
    handleResize();

    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', handleResize);

    // Limpiar listener
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="app-container">
          <Sidebar isOpen={sidebarOpen} toggle={toggleSidebar} />
          <main className={`main-content ${sidebarOpen ? 'shifted' : ''}`}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/sala27" element={<Sala27 />} />
              <Route path="/softgel" element={<Softgel />} />
              <Route path="/produccion" element={<Produccion />} />
              <Route path="/ponderales" element={<Ponderales />} />
              <Route path="/osmosis" element={<Osmosis />} />

            </Routes>
          </main>
        </div>
      </Router>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
