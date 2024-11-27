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
import './styles/App.scss';

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
    <div className="home-page">
      <h1>Bienvenido al Panel de Control</h1>
      <p>Seleccione una sección del menú lateral para comenzar</p>
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
            </Routes>
          </main>
        </div>
      </Router>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
