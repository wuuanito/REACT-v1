// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Sala27 from './pages/Sala27';
import Softgel from './pages/Softgel';
import Produccion from './pages/Produccion';
import Ponderales from './pages/Ponderales';
import './styles/App.scss';

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
  );
};

export default App;