import React, { useState } from 'react';
import Cremer from '../components/sala27/CREMER/cremer';
import CremerDetails from '../components/sala27/CREMER/CremerDetails';



const Sala27: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleStatusChange = (status: string) => {
    console.log(`Estado de conexión: ${status}`);
  };

  const handleError = (error: Error) => {
    console.error('Error en componente Cremer:', error);
  };

  return (
    <div className="sala-container">
      <h1>Sala 27</h1>
      <div className="machines-grid">
        <div onClick={() => setModalVisible(true)} className="machine-card">
          <Cremer nombre="Cremer" onStatusChange={handleStatusChange} onError={handleError} />
        </div>
      </div>

      <CremerDetails 
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
/>
    </div>
  );
};

export default Sala27;