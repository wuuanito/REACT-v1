// src/pages/Sala27.tsx
import React from 'react';
import Cremer from '../components/sala27/cremer';
import Monolab from '../components/sala27/monolab';
import Marquesini from '../components/sala27/marquesini';
import Tecnomaco from '../components/sala27/tecnomaco';
import EnvasadoraPolvo from '../components/sala27/envasadoraPolvo';
import Envasadora2 from '../components/sala27/ensobradora2';
import Envasadora from '../components/sala27/ensobradora2';
import EnvasadoraFlashes from '../components/sala27/envasadoraFlashes';
import LlenadoraJarabes from '../components/sala27/llenadoraJrabes';
import EnvasadoraViales from '../components/sala27/envasadoraViales';
import LlenadoraViales from '../components/sala27/llenadoraViales';
import EnvasadoraDoypack from '../components/sala27/envasadoraDoypack';


const Sala27: React.FC = () => {
  return (
    <div className="page">
      <h1>Sala 27</h1>
      <div className="content">
        <div className="maquinas-grid">
          <div className="maquina-wrapper">
            <Cremer nombre="Cremer" />
          </div>
          <div className="maquina-wrapper">
            <Monolab nombre="Monolab" />
          </div>
            <div className="maquina-wrapper">
                <Marquesini nombre="Marquesini" />
            </div>
            <div className="maquina-wrapper">
                <Tecnomaco nombre="Tecnomaco" />
            </div>
            <div className="maquina-wrapper">
                <EnvasadoraPolvo nombre="Envasadora de Polvo" />
            </div>
            <div className="maquina-wrapper">
                <Envasadora2 nombre="Ensobradora 2" />
            </div>
            <div className="maquina-wrapper">
                <Envasadora nombre="Ensobradora " />
            </div>
            <div className="maquina-wrapper">
                <EnvasadoraFlashes nombre="Ensobradora Flashes" />
            </div>
            <div className="maquina-wrapper">
                <LlenadoraJarabes nombre="Llenadora de Jarabes" />
            </div>
            <div className="maquina-wrapper">
                <EnvasadoraViales nombre="Envasadora de Viales" />
            </div>
            <div className="maquina-wrapper">
                <LlenadoraViales nombre="Llenadora de Viales" />
            </div>
            <div className="maquina-wrapper">
                <EnvasadoraDoypack nombre="Envasadora Doypack" />
            </div>
            
                      {/* Puedes agregar más máquinas aquí y se ajustarán automáticamente */}
        </div>
      </div>
    </div>
  );
};

export default Sala27;