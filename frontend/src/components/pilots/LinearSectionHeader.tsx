// Componente piloto para demostrar tokens de Linear
// Usar tokens desde globals.css: --brand-emerald, --bg-marketing-black, etc.
import React from 'react';

export default function LinearSectionHeader() {
  return (
    <div className='linear-section-header'>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '600',
        color: 'var(--text-primary-linear)',
        letterSpacing: '-0.288px',
      }}>
        Linear Design Tokens Demo
      </h2>
      <p style={{
        fontSize: '15px',
        color: 'var(--text-secondary-linear)',
        lineHeight: '1.60',
      }}>
        Verificación visual de tokens de Linear integrados en globals.css
      </p>
    </div>
  );
}
