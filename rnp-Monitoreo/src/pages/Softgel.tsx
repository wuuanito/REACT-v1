// src/pages/Sala27.tsx
import React from 'react';
import Asf3000s16 from '../components/softgel/asf3000s16';
import Asf300019 from '../components/softgel/asf300019';
import Asf30016 from '../components/softgel/asf30016';


const Softgel: React.FC = () => {
  return (
    <div className="page">
      <h1>Sala 27</h1>
      <div className="content">
        <div className="maquinas-grid">
          <div className="maquina-wrapper">
            <Asf3000s16 nombre="ASF 3000 - S16" />
          </div>
            <div className="maquina-wrapper">
                <Asf300019 nombre="ASF 3000 - 19" />
            </div>
            <div className="maquina-wrapper">
                <Asf30016 nombre="ASF 3000 - 16" />
            </div>
         
            
                      {/* Puedes agregar más máquinas aquí y se ajustarán automáticamente */}
        </div>
      </div>
    </div>
  );
};

export default Softgel;