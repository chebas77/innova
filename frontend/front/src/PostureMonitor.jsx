        // src/PostureMonitor.jsx
        import React, { useState, useEffect, useRef } from 'react';

        const PostureMonitor = () => {
        const [timer, setTimer] = useState(0);
        const [isRunning, setIsRunning] = useState(false);
        const [fastMode, setFastMode] = useState(false);
        const [earlyWarning, setEarlyWarning] = useState(15);
        const [criticalWarning, setCriticalWarning] = useState(30);
        const [exerciseInterval, setExerciseInterval] = useState(45);
        const [isConnected, setIsConnected] = useState(false);
        const [connectionStatus, setConnectionStatus] = useState('Verificando...');
        const [showNotification, setShowNotification] = useState(false);
        const [notification, setNotification] = useState({ title: '', message: '' });
        const [showExerciseModal, setShowExerciseModal] = useState(false);
        const [currentExercise, setCurrentExercise] = useState(null);
        const [earlyWarningShown, setEarlyWarningShown] = useState(false);
        const [criticalWarningShown, setCriticalWarningShown] = useState(false);
        const [lastExerciseTime, setLastExerciseTime] = useState(0);

        const timerInterval = useRef(null);
        const speedMultiplier = fastMode ? 60 : 1;

        // Base de datos de ejercicios
        const exercisesDatabase = {
            exercises: [
            {
                id: 1,
                name: "Estiramiento de Cuello",
                category: "cuello",
                duration: "2-3 minutos",
                difficulty: "Fácil",
                description: "Ideal para aliviar la tensión del cuello por estar mirando una pantalla",
                steps: [
                "Siéntate con la espalda recta",
                "Inclina lentamente la cabeza hacia la derecha, llevando la oreja al hombro",
                "Mantén por 15-20 segundos",
                "Repite hacia el lado izquierdo",
                "Gira la cabeza lentamente hacia la derecha y mantén 15 segundos",
                "Repite hacia la izquierda"
                ],
                benefits: "Reduce tensión cervical, mejora movilidad del cuello",
                frequency: "Cada hora"
            },
            {
                id: 2,
                name: "Rotación de Hombros",
                category: "hombros",
                duration: "1-2 minutos",
                difficulty: "Fácil",
                description: "Perfecto para relajar los hombros tensos por la postura de escritorio",
                steps: [
                "Mantente sentado con la espalda recta",
                "Levanta los hombros hacia las orejas y mantén 5 segundos",
                "Rota lentamente los hombros hacia atrás en círculos grandes",
                "Realiza 10 rotaciones hacia atrás",
                "Cambia dirección: 10 rotaciones hacia adelante",
                "Termina bajando los hombros completamente"
                ],
                benefits: "Alivia tensión en hombros y parte superior de la espalda",
                frequency: "Cada 45 minutos"
            },
            {
                id: 3,
                name: "Estiramiento de Espalda en Silla",
                category: "espalda",
                duration: "3-4 minutos",
                difficulty: "Fácil",
                description: "Ejercicio para elongar la columna vertebral sin levantarse",
                steps: [
                "Siéntate al borde de la silla con los pies planos en el suelo",
                "Coloca las manos detrás de la cabeza",
                "Inclínate lentamente hacia atrás, arqueando suavemente la espalda",
                "Mantén por 15-20 segundos",
                "Vuelve a la posición inicial lentamente",
                "Repite 5 veces"
                ],
                benefits: "Mejora flexibilidad de la columna, reduce rigidez",
                frequency: "Cada hora"
            },
            {
                id: 4,
                name: "Respiración Profunda y Postura",
                category: "respiración",
                duration: "3-4 minutos",
                difficulty: "Fácil",
                description: "Combina trabajo postural con técnicas de respiración relajante",
                steps: [
                "Siéntate con la espalda recta, hombros relajados",
                "Coloca una mano en el pecho, otra en el abdomen",
                "Inhala lentamente por la nariz durante 4 segundos",
                "La mano del abdomen debe moverse más que la del pecho",
                "Mantén el aire por 2 segundos",
                "Exhala lentamente por la boca durante 6 segundos",
                "Repite 10 veces manteniendo la postura correcta"
                ],
                benefits: "Reduce estrés, mejora postura, aumenta concentración",
                frequency: "Cada 45 minutos"
            }
            ]
        };

        // Verificar conexión con el backend
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

        // Enviar comando de vibración al ESP32
        const sendVibrationCommand = async (command) => {
            if (!isConnected) return;
            
            try {
            const response = await fetch('http://localhost:3001/api/vibration', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command })
            });
            
            const data = await response.json();
            console.log('Comando enviado:', data);
            } catch (error) {
            console.error('Error enviando comando:', error);
            }
        };

        // Enviar temporizador al ESP32
        const sendTimerToESP32 = async (seconds) => {
            if (!isConnected) return;
            
            try {
            const response = await fetch('http://localhost:3001/api/timer', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({ seconds: parseInt(seconds) })
            });
            
            const data = await response.json();
            console.log('Temporizador enviado:', data);
            } catch (error) {
            console.error('Error enviando temporizador:', error);
            }
        };

        // Formatear tiempo
        const formatTime = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        // Mostrar notificación
        const displayNotification = (title, message, duration = 5000) => {
            setNotification({ title, message });
            setShowNotification(true);
            
            // Vibrar ESP32 para notificaciones importantes
            if (title.includes('Crítica') || title.includes('Ejercicio')) {
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 2000);
            }
            
            setTimeout(() => {
            setShowNotification(false);
            }, duration);
        };

        // Obtener ejercicio aleatorio
        const getRandomExercise = () => {
            const exercises = exercisesDatabase.exercises;
            const randomIndex = Math.floor(Math.random() * exercises.length);
            return exercises[randomIndex];
        };

        // Mostrar modal de ejercicio
        const openExerciseModal = () => {
            const exercise = getRandomExercise();
            setCurrentExercise(exercise);
            setShowExerciseModal(true);
            
            // Pausar timer si está corriendo
            if (isRunning && timerInterval.current) {
            clearInterval(timerInterval.current);
            }
            
            // Vibración para alerta de ejercicio
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 1000);
            
            displayNotification(
            '💪 ¡Hora de Ejercitarse!',
            `Han pasado ${exerciseInterval} minutos. Es momento de hacer una pausa activa.`,
            3000
            );
        };

        // Cerrar modal de ejercicio
        const closeExerciseModal = () => {
            setShowExerciseModal(false);
            setCurrentExercise(null);
            
            // Reanudar timer si estaba corriendo
            if (isRunning) {
            timerInterval.current = setInterval(() => {
                setTimer(prev => {
                const newTimer = prev + speedMultiplier;
                checkAlerts(newTimer);
                return newTimer;
                });
            }, 1000);
            }
        };

        // Verificar alertas
        const checkAlerts = (currentTimer = timer) => {
            const earlyWarningTime = earlyWarning * 60;
            const criticalWarningTime = criticalWarning * 60;
            const exerciseIntervalSeconds = exerciseInterval * 60;
            
            // Mostrar ejercicios según el intervalo configurado
            if (currentTimer > 0 && currentTimer % exerciseIntervalSeconds === 0 && currentTimer !== lastExerciseTime) {
            openExerciseModal();
            setLastExerciseTime(currentTimer);
            return;
            }
            
            if (currentTimer === earlyWarningTime && !earlyWarningShown) {
            displayNotification(
                '⏰ Alerta Temprana',
                `Has estado sentado por ${earlyWarning} minutos. Considera hacer una pausa.`
            );
            setEarlyWarningShown(true);
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 500);
            }
            
            if (currentTimer === criticalWarningTime && !criticalWarningShown) {
            displayNotification(
                '🚨 ¡Alerta Crítica!',
                `¡Has estado sentado ${criticalWarning} minutos! Es importante que te levantes y te muevas ahora.`,
                8000
            );
            setCriticalWarningShown(true);
            // Vibración más intensa para alerta crítica
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 3000);
            }
            
            // Alertas repetitivas después del tiempo crítico
            if (currentTimer > criticalWarningTime && (currentTimer - criticalWarningTime) % (5 * 60) === 0 && currentTimer !== lastExerciseTime) {
            displayNotification(
                '🔔 Recordatorio',
                '¡Sigue siendo importante moverse! Tu salud postural lo agradecerá.'
            );
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 1000);
            }
        };

        // Iniciar sesión
        const startSession = () => {
            if (!isRunning) {
            setIsRunning(true);
            
            timerInterval.current = setInterval(() => {
                setTimer(prev => {
                const newTimer = prev + speedMultiplier;
                checkAlerts(newTimer);
                return newTimer;
                });
            }, 1000);
            
            displayNotification(
                '✅ Sesión Iniciada',
                'El sensor está ahora monitoreando tu postura. ¡Mantén una buena posición!'
            );
            
            // Vibración de confirmación
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 500);
            }
        };

        // Detener sesión
        const stopSession = () => {
            if (isRunning) {
            setIsRunning(false);
            clearInterval(timerInterval.current);
            
            const minutes = Math.floor(timer / 60);
            displayNotification(
                '⏸️ Sesión Pausada',
                `Tiempo total monitoreado: ${minutes} minutos.`
            );
            
            sendVibrationCommand('1');
            setTimeout(() => sendVibrationCommand('0'), 300);
            }
        };

        // Reiniciar timer
        const resetTimer = () => {
            setIsRunning(false);
            clearInterval(timerInterval.current);
            setTimer(0);
            setEarlyWarningShown(false);
            setCriticalWarningShown(false);
            setLastExerciseTime(0);
            
            displayNotification(
            '🔄 Timer Reiniciado',
            'Contador reseteado. ¡Listo para una nueva sesión!'
            );
        };

        // Marcar ejercicio como completado
        const markExerciseComplete = () => {
            displayNotification(
            '✅ ¡Excelente!',
            'Ejercicio completado. Tu cuerpo te lo agradece. ¡Sigue así!'
            );
            
            // Vibración de felicitación
            sendVibrationCommand('1');
            setTimeout(() => {
            sendVibrationCommand('0');
            setTimeout(() => {
                sendVibrationCommand('1');
                setTimeout(() => sendVibrationCommand('0'), 300);
            }, 300);
            }, 300);
            
            closeExerciseModal();
        };

        // Saltar ejercicio
        const skipExercise = () => {
            displayNotification(
            '⏭️ Ejercicio Saltado',
            'No olvides moverte pronto. Tu salud postural es importante.'
            );
            closeExerciseModal();
        };

        // Obtener otro ejercicio
        const getAnotherExercise = () => {
            const exercise = getRandomExercise();
            setCurrentExercise(exercise);
        };

        // Calcular estado y progreso
        const getStatus = () => {
            const earlyWarningTime = earlyWarning * 60;
            const criticalWarningTime = criticalWarning * 60;
            
            if (timer >= criticalWarningTime) {
            return { status: 'warning', text: '⚠️ Tiempo Crítico - ¡Levántate!', class: 'status-warning' };
            } else if (timer >= earlyWarningTime) {
            return { status: 'warning', text: '🟡 Tiempo Prolongado Sentado', class: 'status-warning' };
            } else if (isRunning) {
            return { status: 'active', text: '🟢 Sensor Activo - Monitoreando', class: 'status-active' };
            } else {
            return { status: 'inactive', text: '🔴 Sensor Inactivo', class: 'status-inactive' };
            }
        };

        const currentStatus = getStatus();
        const progressPercent = Math.min((timer / (criticalWarning * 60)) * 100, 100);

        return (
            <div className="posture-monitor">
            <div className="container">
                <h1>🪑 Monitor de Postura</h1>
                
                {/* Estado de conexión ESP32 */}
                <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                <div className="connection-indicator">
                    <div className={`status-dot ${isConnected ? 'online' : 'offline'}`}></div>
                    <span>ESP32: {connectionStatus}</span>
                </div>
                </div>
                
                <div className="sensor-status">
                <div className={`status-indicator ${currentStatus.class}`}></div>
                <span>{currentStatus.text}</span>
                </div>

                <div className="timer-display">{formatTime(timer)}</div>

                <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>

                <div className="controls">
                <button className="btn-start" onClick={startSession} disabled={!isConnected}>
                    Iniciar Sesión
                </button>
                <button className="btn-stop" onClick={stopSession}>
                    Detener
                </button>
                <button className="btn-reset" onClick={resetTimer}>
                    Reiniciar
                </button>
                </div>

                <div className="settings">
                <h3>⚙️ Configuración</h3>
                <div className="setting-item">
                    <label>Alerta temprana (min):</label>
                    <input 
                    type="number" 
                    value={earlyWarning} 
                    onChange={(e) => setEarlyWarning(parseInt(e.target.value))}
                    min="1" 
                    max="60"
                    />
                </div>
                <div className="setting-item">
                    <label>Alerta crítica (min):</label>
                    <input 
                    type="number" 
                    value={criticalWarning} 
                    onChange={(e) => setCriticalWarning(parseInt(e.target.value))}
                    min="1" 
                    max="120"
                    />
                </div>
                <div className="setting-item">
                    <label>Ejercicios cada (min):</label>
                    <input 
                    type="number" 
                    value={exerciseInterval} 
                    onChange={(e) => setExerciseInterval(parseInt(e.target.value))}
                    min="5" 
                    max="180"
                    />
                </div>
                <div className="setting-item">
                    <label>Simulación rápida:</label>
                    <input 
                    type="checkbox" 
                    checked={fastMode}
                    onChange={(e) => setFastMode(e.target.checked)}
                    />
                </div>
                </div>
            </div>

            {/* Notificación */}
            {showNotification && (
                <div className="notification show">
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                </div>
            )}

            {/* Modal de ejercicios */}
            {showExerciseModal && currentExercise && (
                <div className="modal" style={{ display: 'block' }}>
                <div className="modal-content">
                    <span className="close" onClick={closeExerciseModal}>&times;</span>
                    <div className="exercise-title">💪 ¡Hora de Ejercitarse!</div>
                    <div className="exercise-container">
                    <div className="exercise-info">
                        <h4>🎯 {currentExercise.name}</h4>
                        <p><strong>Descripción:</strong> {currentExercise.description}</p>
                        <p><strong>Beneficios:</strong> {currentExercise.benefits}</p>
                        
                        <div className="exercise-meta">
                        <span>⏱️ Duración: {currentExercise.duration}</span>
                        <span>📊 Dificultad: {currentExercise.difficulty}</span>
                        <span>🏷️ Categoría: {currentExercise.category}</span>
                        </div>
                    </div>
                    
                    <div className="exercise-info">
                        <h4>📋 Instrucciones paso a paso:</h4>
                        <ul className="exercise-steps">
                        {currentExercise.steps.map((step, index) => (
                            <li key={index}>
                            <strong>Paso {index + 1}:</strong> {step}
                            </li>
                        ))}
                        </ul>
                    </div>
                    </div>
                    <div className="modal-buttons">
                    <button className="btn-modal" onClick={markExerciseComplete}>
                        ✅ Completado
                    </button>
                    <button className="btn-modal btn-secondary" onClick={skipExercise}>
                        ⏭️ Saltar
                    </button>
                    <button className="btn-modal btn-secondary" onClick={getAnotherExercise}>
                        🔄 Otro Ejercicio
                    </button>
                    </div>
                </div>
                </div>
            )}

            <style jsx>{`
                .posture-monitor {
                min-height: 100vh;
                width: 100vw;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
                }

                .container {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                width: 90%;
                }

                h1 {
                margin-bottom: 30px;
                font-size: 2.5em;
                font-weight: 300;
                }

                .connection-status {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 12px;
                margin-bottom: 20px;
                border: 2px solid;
                }

                .connection-status.connected {
                border-color: #4ecdc4;
                background: rgba(78, 205, 196, 0.1);
                }

                .connection-status.disconnected {
                border-color: #ff6b6b;
                background: rgba(255, 107, 107, 0.1);
                }

                .connection-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                }

                .sensor-status {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 30px;
                font-size: 1.2em;
                }

                .status-indicator {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                margin-right: 10px;
                transition: all 0.3s ease;
                }

                .status-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                animation: pulse 2s infinite;
                }

                .status-dot.online {
                background: #4ecdc4;
                }

                .status-dot.offline {
                background: #ff6b6b;
                }

                .status-inactive {
                background-color: #ff6b6b;
                box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
                }

                .status-active {
                background-color: #4ecdc4;
                box-shadow: 0 0 10px rgba(78, 205, 196, 0.5);
                }

                .status-warning {
                background-color: #ffd93d;
                box-shadow: 0 0 10px rgba(255, 217, 61, 0.5);
                animation: pulse 1s infinite;
                }

                @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.2); }
                100% { opacity: 1; transform: scale(1); }
                }

                .timer-display {
                font-size: 4em;
                font-weight: bold;
                margin: 30px 0;
                font-family: 'Courier New', monospace;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
                }

                .progress-bar {
                width: 100%;
                height: 10px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 5px;
                margin: 20px 0;
                overflow: hidden;
                }

                .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4ecdc4, #ffd93d, #ff6b6b);
                transition: width 0.3s ease;
                border-radius: 5px;
                }

                .controls {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-bottom: 30px;
                flex-wrap: wrap;
                }

                button {
                padding: 12px 24px;
                border: none;
                border-radius: 25px;
                font-size: 1em;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
                }

                button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                }

                .btn-start {
                background: linear-gradient(45deg, #4ecdc4, #44a08d);
                color: white;
                }

                .btn-stop {
                background: linear-gradient(45deg, #ff6b6b, #ee5a52);
                color: white;
                }

                .btn-reset {
                background: linear-gradient(45deg, #ffd93d, #f39c12);
                color: #333;
                }

                button:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }

                .settings {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 15px;
                padding: 20px;
                margin-top: 20px;
                }

                .settings h3 {
                margin-bottom: 15px;
                font-size: 1.2em;
                }

                .setting-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                flex-wrap: wrap;
                gap: 10px;
                }

                input[type="number"] {
                width: 80px;
                padding: 8px;
                border: none;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                text-align: center;
                }

                input[type="checkbox"] {
                width: 20px;
                height: 20px;
                }

                .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(45deg, #ff6b6b, #ee5a52);
                color: white;
                padding: 20px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 300px;
                z-index: 1000;
                animation: slideInRight 0.5s ease;
                }

                @keyframes slideInRight {
                from { transform: translateX(400px); }
                to { transform: translateX(0); }
                }

                .notification h4 {
                margin-bottom: 10px;
                font-size: 1.2em;
                }

                .modal {
                position: fixed;
                z-index: 2000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(5px);
                animation: fadeIn 0.3s ease;
                }

                .modal-content {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 2% auto;
                padding: 30px;
                border-radius: 20px;
                width: 95%;
                max-width: 700px;
                max-height: 90vh;
                color: white;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                position: relative;
                animation: slideIn 0.4s ease;
                overflow-y: auto;
                }

                @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
                }

                @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
                }

                .close {
                position: absolute;
                right: 15px;
                top: 10px;
                color: rgba(255, 255, 255, 0.8);
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.1);
                }

                .close:hover {
                color: #ff6b6b;
                background: rgba(255, 107, 107, 0.2);
                transform: scale(1.1);
                }

                .exercise-title {
                font-size: 1.8em;
                margin-bottom: 15px;
                text-align: center;
                color: #ffd93d;
                }

                .exercise-info {
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 15px;
                margin-bottom: 20px;
                text-align: left;
                }

                .exercise-info h4 {
                color: #4ecdc4;
                margin-bottom: 10px;
                font-size: 1.3em;
                }

                .exercise-steps {
                list-style: none;
                padding: 0;
                margin: 0;
                }

                .exercise-steps li {
                background: rgba(255, 255, 255, 0.05);
                margin: 8px 0;
                padding: 15px;
                border-radius: 10px;
                border-left: 4px solid #4ecdc4;
                line-height: 1.5;
                }

                .exercise-steps li strong {
                color: #4ecdc4;
                display: block;
                margin-bottom: 5px;
                }

                .exercise-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 15px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                font-size: 0.9em;
                flex-wrap: wrap;
                gap: 10px;
                }

                .exercise-meta span {
                background: rgba(255, 255, 255, 0.1);
                padding: 5px 10px;
                border-radius: 15px;
                white-space: nowrap;
                }

                .modal-buttons {
                text-align: center;
                margin-top: 25px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
                }

                .btn-modal {
                background: linear-gradient(45deg, #4ecdc4, #44a08d);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 0.9em;
                font-weight: bold;
                transition: all 0.3s ease;
                flex: 1;
                min-width: 120px;
                max-width: 180px;
                }

                .btn-modal:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }

                .btn-secondary {
                background: linear-gradient(45deg, #ffd93d, #f39c12);
                color: #333;
                }

                @media (max-width: 768px) {
                .posture-monitor {
                    padding: 10px;
                }

                .container {
                    padding: 20px;
                    width: 95%;
                }

                .timer-display {
                    font-size: 3em;
                }

                .controls {
                    flex-direction: column;
                    align-items: center;
                }

                .controls button {
                    width: 100%;
                    max-width: 200px;
                }

                .setting-item {
                    flex-direction: column;
                    align-items: stretch;
                    text-align: left;
                }

                .modal-content {
                    margin: 1% auto;
                    padding: 20px;
                    width: 98%;
                }

                .exercise-meta {
                    flex-direction: column;
                    align-items: stretch;
                }

                .exercise-meta span {
                    text-align: center;
                }

                .btn-modal {
                    min-width: 100px;
                    font-size: 0.8em;
                    padding: 10px 15px;
                }
                }

                @media (max-width: 480px) {
                .timer-display {
                    font-size: 2.5em;
                }

                .notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                }
            `}</style>
            </div>
        );
        };

        export default PostureMonitor;