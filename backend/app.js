// backend/app.js
const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Variables globales del estado
let serialPort = null;
let isConnected = false;
let currentPort = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Lista de puertos comunes para ESP32
const commonPorts = [
  'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10',
  '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2', '/dev/ttyUSB3',
  '/dev/ttyACM0', '/dev/ttyACM1', '/dev/cu.usbserial-0001'
];

// Buscar ESP32 automáticamente
async function findESP32() {
  console.log('🔍 Buscando ESP32 en puertos disponibles...');
  
  try {
    const ports = await SerialPort.list();
    console.log('📋 Puertos detectados:', ports.map(p => `${p.path} (${p.manufacturer || 'Unknown'})`));
    
    // Buscar por fabricante típico de ESP32
    const esp32Port = ports.find(port => {
      const manufacturer = (port.manufacturer || '').toLowerCase();
      return manufacturer.includes('silicon labs') ||
             manufacturer.includes('ftdi') ||
             manufacturer.includes('qinheng') ||
             manufacturer.includes('ch340') ||
             manufacturer.includes('cp210');
    });
    
    if (esp32Port) {
      console.log(`✅ ESP32 detectado por fabricante: ${esp32Port.path}`);
      return esp32Port.path;
    }
    
    // Si no encuentra por fabricante, probar puertos comunes
    for (const port of commonPorts) {
      try {
        const testPort = new SerialPort({ path: port, baudRate: 115200 });
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 1000);
          testPort.on('open', () => {
            clearTimeout(timeout);
            testPort.close();
            resolve();
          });
          testPort.on('error', reject);
        });
        console.log(`✅ ESP32 encontrado en puerto común: ${port}`);
        return port;
      } catch (err) {
        // Puerto no disponible, continuar
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error buscando puertos:', error.message);
    return null;
  }
}

// Conectar al ESP32
async function connectToESP32() {
  try {
    // Cerrar conexión anterior si existe
    if (serialPort && serialPort.isOpen) {
      serialPort.close();
    }

    const portPath = await findESP32();
    
    if (!portPath) {
      console.log('❌ ESP32 no encontrado.');
      isConnected = false;
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 Reintento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en 5 segundos...`);
        setTimeout(connectToESP32, 5000);
      } else {
        console.log('⏸️  Máximo de reintentos alcanzado. Esperando reconexión manual.');
      }
      return;
    }
    
    console.log(`🔌 Intentando conectar a: ${portPath}`);
    
    serialPort = new SerialPort({
      path: portPath,
      baudRate: 115200, // Usar 115200 como estándar
      autoOpen: false
    });
    
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    // Manejar apertura del puerto
    serialPort.open((err) => {
      if (err) {
        console.error(`❌ Error abriendo ${portPath}:`, err.message);
        
        if (err.message.includes('Access denied') || err.message.includes('busy')) {
          console.log('💡 El puerto está ocupado. Cierra Arduino IDE o Monitor Serie.');
        }
        
        isConnected = false;
        setTimeout(connectToESP32, 5000);
        return;
      }
      
      console.log(`✅ ESP32 conectado exitosamente en ${portPath}`);
      isConnected = true;
      currentPort = portPath;
      reconnectAttempts = 0;
      
      // Enviar comando de prueba después de conectar
      setTimeout(() => {
        if (serialPort && serialPort.isOpen) {
          serialPort.write('ping\n', (err) => {
            if (!err) {
              console.log('📡 Comando de prueba enviado al ESP32');
            }
          });
        }
      }, 2000);
    });
    
    // Manejar datos recibidos del ESP32
    parser.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`📥 ESP32 responde: ${message}`);
      
      // Procesar respuestas específicas si es necesario
      if (message.includes('ready') || message.includes('connected')) {
        console.log('🎯 ESP32 confirmó que está listo');
      }
    });
    
    // Manejar errores del puerto
    serialPort.on('error', (err) => {
      console.error('❌ Error en puerto serial:', err.message);
      isConnected = false;
      
      // Auto-reconexión en caso de error
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(connectToESP32, 3000);
      }
    });
    
    // Manejar cierre del puerto
    serialPort.on('close', () => {
      console.log('🔌 Conexión ESP32 cerrada');
      isConnected = false;
      
      // Auto-reconexión si no alcanzamos el máximo
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 Reconectando automáticamente... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connectToESP32, 3000);
      }
    });
    
  } catch (error) {
    console.error('❌ Error fatal conectando ESP32:', error.message);
    isConnected = false;
    setTimeout(connectToESP32, 5000);
  }
}

// Enviar comando al ESP32 con validación
function sendToESP32(command) {
  return new Promise((resolve, reject) => {
    if (!isConnected || !serialPort || !serialPort.isOpen) {
      reject(new Error('ESP32 no está conectado'));
      return;
    }
    
    console.log(`📤 Enviando comando: "${command}"`);
    
    serialPort.write(command + '\n', (err) => {
      if (err) {
        console.error('❌ Error enviando comando:', err.message);
        reject(err);
      } else {
        console.log(`✅ Comando "${command}" enviado correctamente`);
        resolve({ success: true, command });
      }
    });
  });
}

// Iniciar conexión automática al arrancar
connectToESP32();

// === RUTAS DE LA API ===

// Estado general del sistema
app.get('/api/status', (req, res) => {
  res.json({ 
    server: 'ESP32 Controller Backend',
    version: '1.0.0',
    esp32Connected: isConnected,
    currentPort: currentPort,
    uptime: process.uptime(),
    reconnectAttempts: reconnectAttempts,
    timestamp: new Date().toISOString()
  });
});

// Estado de conexión (requerido por el frontend)
app.get('/api/connection', (req, res) => {
  res.json({
    connected: isConnected,
    port: currentPort || 'No detectado',
    attempts: reconnectAttempts,
    maxAttempts: MAX_RECONNECT_ATTEMPTS,
    timestamp: new Date().toISOString()
  });
});

// Control de vibración ON/OFF (compatible con frontend)
app.post('/api/vibration', async (req, res) => {
  try {
    const { command } = req.body;
    
    // Validar comando
    if (!command || (command !== '0' && command !== '1')) {
      return res.status(400).json({
        success: false,
        error: 'Comando inválido. Use "0" para OFF o "1" para ON',
        received: command
      });
    }

    // Verificar conexión
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        error: 'ESP32 no está conectado',
        command: command
      });
    }

    // Enviar comando al ESP32
    // Tu ESP32 espera comandos simples: "1" para ON, "0" para OFF
    await sendToESP32(command);
    
    res.json({
      success: true,
      message: `Vibración ${command === '1' ? 'activada' : 'desactivada'}`,
      command: command,
      port: currentPort,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en /api/vibration:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      command: req.body.command
    });
  }
});

// Temporizador (requerido por el frontend)
app.post('/api/timer', async (req, res) => {
  try {
    const { seconds } = req.body;
    
    // Validar entrada
    if (!seconds || isNaN(seconds) || seconds < 1 || seconds > 3600) {
      return res.status(400).json({
        success: false,
        error: 'Tiempo inválido. Use entre 1 y 3600 segundos',
        received: seconds
      });
    }

    // Verificar conexión
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        error: 'ESP32 no está conectado'
      });
    }

    // Enviar temporizador al ESP32
    // Tu ESP32 debe interpretar números como duración en segundos
    await sendToESP32(seconds.toString());
    
    res.json({
      success: true,
      message: `Temporizador iniciado: ${seconds} segundos`,
      seconds: parseInt(seconds),
      port: currentPort,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en /api/timer:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      seconds: req.body.seconds
    });
  }
});

// Reconexión manual (requerido por el frontend)
app.post('/api/reconnect', async (req, res) => {
  try {
    console.log('🔄 Reconexión manual solicitada por el frontend');
    
    // Resetear intentos
    reconnectAttempts = 0;
    isConnected = false;
    
    // Cerrar puerto actual si existe
    if (serialPort && serialPort.isOpen) {
      serialPort.close();
    }
    
    // Intentar reconectar
    setTimeout(connectToESP32, 1000);
    
    res.json({
      success: true,
      message: 'Reconexión iniciada',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en reconexión:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar puertos disponibles (útil para debugging)
app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json({
      ports: ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        vendorId: port.vendorId,
        productId: port.productId,
        isCommon: commonPorts.includes(port.path)
      })),
      commonPorts: commonPorts,
      currentConnection: {
        connected: isConnected,
        port: currentPort
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', err.message);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Ruta 404 - CORREGIDA
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      'GET /api/status',
      'GET /api/connection', 
      'POST /api/vibration',
      'POST /api/timer',
      'POST /api/reconnect',
      'GET /api/ports'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Backend ESP32 corriendo en http://localhost:${PORT}`);
  console.log('📡 Endpoints disponibles:');
  console.log('   GET  /api/connection - Estado de conexión');
  console.log('   POST /api/vibration - Control ON/OFF');
  console.log('   POST /api/timer - Temporizadores');
  console.log('   POST /api/reconnect - Reconectar ESP32');
  console.log('   GET  /api/ports - Listar puertos');
  console.log('\n🔍 Buscando ESP32 automáticamente...');
});

// Cierre limpio del servidor
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  if (serialPort && serialPort.isOpen) {
    console.log('🔌 Cerrando conexión serial...');
    serialPort.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Servidor terminado');
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  process.exit(0);
});