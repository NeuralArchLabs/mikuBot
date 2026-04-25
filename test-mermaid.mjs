import mermaid from 'mermaid';
const code = \quadrantChart
  title Guadalajara HOY - Radar
  x-axis Baja Prioridad --> Alta Prioridad
  y-axis Negativo --> Positivo
  quadrant-1 Acción Inmediata
  quadrant-2 Vigilar
  quadrant-3 Con calma
  quadrant-4 Buen momento
  Clima soleado: [0.3, 0.9]\;
  
mermaid.default.parse(code).then(() => console.log('Parsed successfully')).catch(e => console.log('Error:', e.message));
