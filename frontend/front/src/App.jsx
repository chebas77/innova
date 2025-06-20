// src/App.jsx
import React, { useState, useEffect } from 'react';
import exercisesData from './exercises.json'; // Importar el JSON
import PostureMonitor from './PostureMonitor'; // Importar el nuevo componente
import './App.css';

function App() {
  const [status, setStatus] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Verificando...');
  const [customTimer, setCustomTimer] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastActivity, setLastActivity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('meditation');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [activeView, setActiveView] = useState('manual'); // 'manual', 'exercises', 'posture'

  // Verificar conexión cada 3 segundos
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/connection');
      const data = await response.json();
      setIsConnected(data.connected);
      setConnectionStatus(data.connected ? 
        `Conectado en ${data.port}` : 
        'ESP32 desconectado'
      );
    } catch (error) {
      setIsConnected(false);
      setConnectionStatus('Backend no disponible');
    }
  };

  const sendCommand = async (command) => {
    if (!isConnected) {
      setStatus('Error: ESP32 no conectado');
      return false;
    }

    try {
      console.log(`🔥 Enviando comando de vibración: ${command}`);
      const response = await fetch('http://localhost:3001/api/vibration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: command.toString() })
      });
      
      const data = await response.json();
      console.log('✅ Respuesta del servidor:', data);
      
      if (data.success) {
        setStatus(`✅ Comando ${command} enviado correctamente`);
        setLastActivity(`Vibración ${command === '1' ? 'ACTIVADA ⚡' : 'DESACTIVADA ⏹️'} - ${new Date().toLocaleTimeString()}`);
        return true;
      } else {
        setStatus(`❌ Error: ${data.error || 'Comando no enviado'}`);
        return false;
      }
    } catch (error) {
      setStatus('❌ Error de conexión con el backend');
      console.error('Error enviando comando:', error);
      return false;
    }
  };

  const sendTimer = async (seconds) => {
    if (!isConnected) {
      setStatus('Error: ESP32 no conectado');
      return false;
    }

    try {
      console.log(`⏱️ Enviando temporizador: ${seconds} segundos`);
      const response = await fetch('http://localhost:3001/api/timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seconds: parseInt(seconds) })
      });
      
      const data = await response.json();
      console.log('✅ Respuesta del temporizador:', data);
      
      if (data.success) {
        setStatus(`⏱️ Temporizador iniciado: ${seconds}s`);
        setLastActivity(`Temporizador ${seconds}s iniciado - ${new Date().toLocaleTimeString()}`);
        setCustomTimer('');
        return true;
      } else {
        setStatus(`❌ Error: ${data.error || 'Temporizador no enviado'}`);
        return false;
      }
    } catch (error) {
      setStatus('❌ Error de conexión con el backend');
      console.error('Error enviando temporizador:', error);
      return false;
    }
  };

  const executeExercise = async (exercise) => {
    setStatus(`🏃‍♂️ Ejecutando: ${exercise.name}`);
    setLastActivity(`Ejercicio "${exercise.name}" iniciado - ${new Date().toLocaleTimeString()}`);
    
    // Convertir la duración del ejercicio a segundos
    let durationInSeconds = exercise.duration; // Valor por defecto
    
    if (typeof exercise.duration === 'string') {
      // Extraer números de strings como "2-3 minutos", "30 segundos", etc.
      const match = exercise.duration.match(/(\d+)/);
      if (match) {
        const firstNumber = parseInt(match[1]);
        if (exercise.duration.includes('minuto')) {
          durationInSeconds = firstNumber * 60; // Convertir minutos a segundos
        } else {
          durationInSeconds = firstNumber; // Ya en segundos
        }
      } else {
        durationInSeconds = 120; // 2 minutos por defecto
      }
    }
    
    // Primero encender vibración por 1 segundo para indicar inicio
    const success = await sendCommand('1');
    if (success) {
      setTimeout(async () => {
        await sendCommand('0');
        // Luego enviar el temporizador completo del ejercicio
        await sendTimer(durationInSeconds);
      }, 1000);
    }
  };

  const reconnect = async () => {
    try {
      setStatus('🔄 Reconectando...');
      const response = await fetch('http://localhost:3001/api/reconnect', {
        method: 'POST'
      });
      setTimeout(checkConnection, 2000);
    } catch (error) {
      setStatus('❌ Error al reconectar');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // 🧪 Función de prueba rápida
  const testVibration = async () => {
    console.log('🧪 Iniciando prueba de vibración...');
    const success1 = await sendCommand('1');
    if (success1) {
      setTimeout(async () => {
        console.log('🧪 Apagando vibración...');
        await sendCommand('0');
      }, 2000);
    }
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="header-icon">⚡</div>
          <h1 className="title">Sistema ESP32 Terapéutico</h1>
          <div className="subtitle">Control avanzado de vibración para bienestar</div>
        </header>

        {/* Navigation */}
        <nav className="navigation">
          <button 
            className={`nav-btn ${activeView === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveView('manual')}
          >
            🎛️ Control Manual
          </button>
          <button 
            className={`nav-btn ${activeView === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveView('exercises')}
          >
            🧘‍♀️ Ejercicios Terapéuticos
          </button>
          <button 
            className={`nav-btn ${activeView === 'posture' ? 'active' : ''}`}
            onClick={() => setActiveView('posture')}
          >
            🪑 Monitor de Postura
          </button>
        </nav>

        {/* Estado de conexión */}
        <div className={`connection-card ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="connection-status">
            <div className="status-indicator">
              <div className={`status-dot ${isConnected ? 'online' : 'offline'}`}></div>
              <span className="status-text">{connectionStatus}</span>
            </div>
            {!isConnected && (
              <button onClick={reconnect} className="reconnect-btn">
                🔄 Reconectar
              </button>
            )}
          </div>
        </div>

        {/* Vista de Monitor de Postura */}
        {activeView === 'posture' && (
          <PostureMonitor />
        )}

        {/* Vista de Control Manual */}
        {activeView === 'manual' && (
          <div className="controls-grid">
            {/* Pruebas de vibración */}
            <div className="control-section">
              <div className="section-header">
                <span className="section-icon">🧪</span>
                <h3>Pruebas de Vibración</h3>
              </div>
              <div className="button-group">
                <button 
                  onClick={() => sendCommand('1')}
                  className="btn btn-success"
                  disabled={!isConnected}
                >
                  <span className="btn-icon">⚡</span>
                  Vibración ON
                </button>
                <button 
                  onClick={() => sendCommand('0')}
                  className="btn btn-danger"
                  disabled={!isConnected}
                >
                  <span className="btn-icon">⏹️</span>
                  Vibración OFF
                </button>
                <button 
                  onClick={testVibration}
                  className="btn btn-primary"
                  disabled={!isConnected}
                >
                  <span className="btn-icon">🔔</span>
                  Pulso 2s
                </button>
              </div>
              
              {/* 🚨 Panel de debug */}
              {isConnected && (
                <div className="debug-panel">
                  <small>🔍 Debug: Abre la consola (F12) para ver los logs detallados</small>
                </div>
              )}
            </div>

            {/* Temporizadores rápidos */}
            <div className="control-section">
              <div className="section-header">
                <span className="section-icon">⏱️</span>
                <h3>Temporizadores Rápidos</h3>
              </div>
              <div className="timer-grid">
                <button onClick={() => sendTimer(5)} className="timer-btn" disabled={!isConnected}>
                  <span className="timer-value">5</span>
                  <span className="timer-unit">seg</span>
                </button>
                <button onClick={() => sendTimer(10)} className="timer-btn" disabled={!isConnected}>
                  <span className="timer-value">10</span>
                  <span className="timer-unit">seg</span>
                </button>
                <button onClick={() => sendTimer(30)} className="timer-btn" disabled={!isConnected}>
                  <span className="timer-value">30</span>
                  <span className="timer-unit">seg</span>
                </button>
                <button onClick={() => sendTimer(60)} className="timer-btn" disabled={!isConnected}>
                  <span className="timer-value">1</span>
                  <span className="timer-unit">min</span>
                </button>
                <button onClick={() => sendTimer(120)} className="timer-btn" disabled={!isConnected}>
                  <span className="timer-value">2</span>
                  <span className="timer-unit">min</span>
                </button>
                <button onClick={() => sendTimer(300)} className="timer-btn" disabled={!isConnected}>
                  <span className="timer-value">5</span>
                  <span className="timer-unit">min</span>
                </button>
              </div>
            </div>

            {/* Temporizador personalizado */}
            <div className="control-section">
              <div className="section-header">
                <span className="section-icon">🎯</span>
                <h3>Temporizador Personalizado</h3>
              </div>
              <div className="custom-timer">
                <div className="input-group">
                  <input
                    type="number"
                    value={customTimer}
                    onChange={(e) => setCustomTimer(e.target.value)}
                    placeholder="Segundos"
                    className="timer-input"
                    min="1"
                    max="3600"
                    disabled={!isConnected}
                  />
                  <button 
                    onClick={() => customTimer && sendTimer(customTimer)}
                    disabled={!customTimer || !isConnected}
                    className="btn btn-primary"
                  >
                    <span className="btn-icon">▶️</span>
                    Iniciar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Ejercicios */}
        {activeView === 'exercises' && (
          <div className="exercises-view">
            {/* Categorías */}
            <div className="categories">
              {Object.entries(exercisesData.exercises).map(([key, category]) => (
                <button
                  key={key}
                  className={`category-btn ${selectedCategory === key ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(key)}
                >
                  <span className="category-icon">{category.icon}</span>
                  <span className="category-name">{category.name}</span>
                </button>
              ))}
            </div>

            {/* Ejercicios de la categoría seleccionada */}
            <div className="exercises-grid">
              {exercisesData.exercises[selectedCategory]?.programs.map((exercise) => (
                <div key={exercise.id} className="exercise-card">
                  <div className="exercise-header">
                    <h4 className="exercise-title">{exercise.name}</h4>
                    <span className={`difficulty-badge ${exercise.difficulty}`}>
                      {exercise.difficulty}
                    </span>
                  </div>
                  <p className="exercise-description">{exercise.description}</p>
                  <div className="exercise-details">
                    <span className="exercise-duration">⏱️ {formatDuration(exercise.duration)}</span>
                    <span className="exercise-cycles">🔄 {exercise.cycles} ciclos</span>
                  </div>
                  <button
                    className="btn btn-primary exercise-btn"
                    onClick={() => executeExercise(exercise)}
                    disabled={!isConnected}
                  >
                    <span className="btn-icon">▶️</span>
                    Iniciar Ejercicio
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel de estado */}
        <div className="status-panel">
          <div className="status-header">
            <span className="status-icon">📊</span>
            <h4>Estado del Sistema</h4>
          </div>
          <div className="status-content">
            <div className="status-item">
              <span className="status-label">Estado actual:</span>
              <span className="status-value">{status || 'Esperando comando...'}</span>
            </div>
            {lastActivity && (
              <div className="status-item">
                <span className="status-label">Última actividad:</span>
                <span className="status-value">{lastActivity}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
        .app {
          min-height: 100vh;
          width: 100vw;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          box-sizing: border-box;
          margin: 0;
          overflow-x: hidden;
        }

        * {
          box-sizing: border-box;
        }

        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
          color: white;
        }

        .header-icon {
          font-size: 3rem;
          margin-bottom: 10px;
        }

        .title {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .subtitle {
          font-size: 1.1rem;
          opacity: 0.9;
          font-weight: 300;
        }

        .navigation {
          display: flex;
          gap: 12px;
          margin-bottom: 30px;
          justify-content: center;
        }

        .nav-btn {
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
          backdrop-filter: blur(10px);
        }

        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
          transform: translateY(-2px);
        }

        .nav-btn.active {
          background: white;
          color: #667eea;
          border-color: white;
        }

        .connection-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          border: 2px solid;
          transition: all 0.3s ease;
        }

        .connection-card.connected {
          border-color: #10b981;
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
        }

        .connection-card.disconnected {
          border-color: #ef4444;
          background: linear-gradient(135deg, #fef2f2 0%, #fef2f2 100%);
        }

        .connection-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-dot.online {
          background: #10b981;
        }

        .status-dot.offline {
          background: #ef4444;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          font-weight: 600;
          font-size: 1.1rem;
        }

        .reconnect-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .reconnect-btn:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .controls-grid {
          display: grid;
          gap: 24px;
          margin-bottom: 30px;
        }

        .control-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          transition: transform 0.2s ease;
        }

        .control-section:hover {
          transform: translateY(-2px);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f1f5f9;
        }

        .section-icon {
          font-size: 1.5rem;
        }

        .section-header h3 {
          margin: 0;
          color: #1e293b;
          font-weight: 600;
        }

        .button-group {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .debug-panel {
          margin-top: 15px;
          padding: 10px;
          background: #f0f9ff;
          border-radius: 8px;
          border-left: 4px solid #0ea5e9;
        }

        .debug-panel small {
          color: #0369a1;
          font-weight: 500;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 1rem;
          min-width: 140px;
          justify-content: center;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .btn-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
        }

        .timer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
        }

        .timer-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 12px;
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 80px;
          justify-content: center;
        }

        .timer-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(6, 182, 212, 0.3);
        }

        .timer-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .timer-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }

        .timer-unit {
          font-size: 0.875rem;
          opacity: 0.9;
          margin-top: 4px;
        }

        .input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .timer-input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background: #f8fafc;
        }

        .timer-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .timer-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .exercises-view {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .categories {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .category-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
        }

        .category-btn:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          border-color: #667eea;
        }

        .category-btn.active {
          border-color: #667eea;
          background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
        }

        .category-icon {
          font-size: 2rem;
          margin-bottom: 8px;
        }

        .category-name {
          font-weight: 600;
          color: #1e293b;
        }

        .exercises-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .exercise-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          transition: transform 0.3s ease;
          border: 2px solid transparent;
        }

        .exercise-card:hover {
          transform: translateY(-4px);
          border-color: #667eea;
        }

        .exercise-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .exercise-title {
          margin: 0;
          color: #1e293b;
          font-weight: 600;
          font-size: 1.25rem;
        }

        .difficulty-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
          text-transform: capitalize;
        }

        .difficulty-badge.beginner {
          background: #dcfce7;
          color: #166534;
        }

        .difficulty-badge.intermediate {
          background: #fef3c7;
          color: #92400e;
        }

        .difficulty-badge.advanced {
          background: #fee2e2;
          color: #991b1b;
        }

        .exercise-description {
          color: #64748b;
          margin-bottom: 16px;
          line-height: 1.6;
        }

        .exercise-details {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          font-size: 0.875rem;
          color: #64748b;
        }

        .exercise-duration, .exercise-cycles {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .exercise-btn {
          width: 100%;
        }

        .status-panel {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f1f5f9;
        }

        .status-icon {
          font-size: 1.25rem;
        }

        .status-header h4 {
          margin: 0;
          color: #1e293b;
          font-weight: 600;
        }

        .status-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }

        .status-label {
          font-weight: 500;
          color: #64748b;
        }

        .status-value {
          font-family: 'Monaco', 'Menlo', monospace;
          color: #1e293b;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .app {
            padding: 16px;
          }

          .title {
            font-size: 2rem;
          }

          .timer-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .input-group {
            flex-direction: column;
          }

          .timer-input {
            width: 100%;
          }

          .status-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .navigation {
            flex-direction: column;
            align-items: center;
          }

          .nav-btn {
            width: 100%;
            max-width: 300px;
          }

          .categories {
            grid-template-columns: repeat(2, 1fr);
          }

          .exercises-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .app {
            padding: 12px;
          }

          .categories {
            grid-template-columns: 1fr;
          }

          .timer-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}
      </style>
    </div>
  );
}

export default App;