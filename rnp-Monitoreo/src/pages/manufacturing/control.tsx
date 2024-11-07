// src/pages/manufacturing/control.tsx

import React from 'react';
import Head from 'next/head';

const ManufacturingControlPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Control de Fabricación</title>
      </Head>
      <iframe 
        src="/manufacturing-control.html" 
        className="w-full h-screen border-none"
      />
    </>
  );
};

export default ManufacturingControlPage