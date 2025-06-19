// backend/app.js
const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Configuración Serial
let serialPort = null;
let isConnected = false;
let currentPort = null;

// Lista de puertos COM comunes para ESP32
const commonPorts = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10'];

// Buscar ESP32 en puertos COM
async function findESP32() {
  console.log('Buscando ESP32 en puertos COM...');
  
  try {
    const ports = await SerialPort.list();
    console.log('Puertos disponibles:', ports.map(p => `${p.path} (${p.manufacturer || 'Unknown'})`));
    
    // Buscar puertos con chips comunes de ESP32
    const esp32Port = ports.find(port => 
      port.manufacturer && (
        port.manufacturer.includes('Silicon Labs') ||
        port.manufacturer.includes('FTDI') ||
        port.manufacturer.includes('QinHeng Electronics') ||
        port.path.startsWith('COM')
      )
    );
    
    if (esp32Port) {
      console.log(`Posible ESP32 encontrado en: ${esp32Port.path}`);
      return esp32Port.path;
    }
    
    // Si no encuentra por manufacturer, probar puertos comunes
    for (const port of commonPorts) {
      try {
        const testPort = new SerialPort({ path: port, baudRate: 115200 });
        await new Promise((resolve, reject) => {
          testPort.on('open', () => {
            testPort.close();
            resolve();
          });
          testPort.on('error', reject);
        });
        console.log(`ESP32 encontrado en: ${port}`);
        return port;
      } catch (err) {
        // Puerto no disponible, continuar
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error buscando puertos:', error);
    return null;
  }
}

// Conectar al ESP32
async function connectToESP32() {
  try {
    const portPath = await findESP32();
    
    if (!portPath) {
      console.log('❌ ESP32 no encontrado. Reintentando en 10 segundos...');
      setTimeout(connectToESP32, 10000);
      return;
    }
    
    serialPort = new SerialPort({
      path: portPath,
      baudRate: 9600, // Cambiar a 9600 para coincidir con tu ESP32
      autoOpen: false
    });
    
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    serialPort.open((err) => {
      if (err) {
        if (err.message.includes('Access denied') || err.message.includes('busy')) {
          console.error(`❌ Puerto ${portPath} está ocupado por otro programa`);
          console.log('💡 Cierra el Arduino IDE o cualquier monitor serie');
        } else {
          console.error('Error abriendo puerto:', err.message);
        }
        setTimeout(connectToESP32, 10000); // Esperar más tiempo
        return;
      }
      
      console.log(`✅ Conectado al ESP32 en ${portPath}`);
      isConnected = true;
      currentPort = portPath;
    });
    
    // Recibir datos del ESP32
    parser.on('data', (data) => {
      console.log('ESP32 dice:', data.trim());
    });
    
    // Manejar errores
    serialPort.on('error', (err) => {
      console.error('Error en puerto serial:', err.message);
      isConnected = false;
      setTimeout(connectToESP32, 5000);
    });
    
    // Manejar desconexión
    serialPort.on('close', () => {
      console.log('⚠️  ESP32 desconectado. Reintentando...');
      isConnected = false;
      setTimeout(connectToESP32, 5000);
    });
    
  } catch (error) {
    console.error('Error conectando:', error);
    setTimeout(connectToESP32, 5000);
  }
}

// Enviar comando al ESP32
function sendToESP32(command) {
  return new Promise((resolve, reject) => {
    if (!isConnected || !serialPort) {
      reject(new Error('ESP32 no está conectado'));
      return;
    }
    
    serialPort.write(command + '\n', (err) => {
      if (err) {
        console.error('Error enviando comando:', err);
        reject(err);
      } else {
        console.log(`📤 Comando enviado: ${command}`);
        resolve({ success: true, command });
      }
    });
  });
}

// Iniciar conexión
connectToESP32();

// === RUTAS API ===

app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Backend funcionando!', 
    esp32Connected: isConnected,
    currentPort: currentPort,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/vibration', async (req, res) => {
  const { command } = req.body;
  
  try {
    if (!isConnected) {
      return res.status(503).json({ 
        success: false, 
        error: 'ESP32 no está conectado',
        command 
      });
    }

    // Mapear comandos del frontend a lo que entiende tu ESP32
    let esp32Command;
    if (command === '1') {
      // Para vibrar, enviamos un temporizador muy corto (1 segundo)
      esp32Command = '1';
    } else if (command === '0') {
      // Para parar vibración, enviar un comando inválido que reinicie
      esp32Command = 'stop';
    } else {
      // Comando directo (números para temporizador)
      esp32Command = command;
    }

    const result = await sendToESP32(esp32Command);
    res.json({ 
      success: true, 
      originalCommand: command,
      sentToESP32: esp32Command,
      port: currentPort,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error al enviar comando:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      command 
    });
  }
});

// Nueva ruta para temporizador específico
app.post('/api/timer', async (req, res) => {
  const { seconds } = req.body;
  
  try {
    if (!isConnected) {
      return res.status(503).json({ 
        success: false, 
        error: 'ESP32 no está conectado'
      });
    }

    // Enviar directamente los segundos como string
    const result = await sendToESP32(seconds.toString());
    res.json({ 
      success: true, 
      timerSeconds: seconds,
      port: currentPort,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error al enviar temporizador:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Reconectar manualmente
app.post('/api/reconnect', (req, res) => {
  console.log('🔄 Reconexión manual solicitada');
  isConnected = false;
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  setTimeout(connectToESP32, 1000);
  res.json({ message: 'Reintentando conexión...' });
});

// Estado de conexión
app.get('/api/connection', (req, res) => {
  res.json({
    connected: isConnected,
    port: currentPort,
    timestamp: new Date().toISOString()
  });
});

// Listar puertos disponibles
app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json({
      ports: ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        vendorId: port.vendorId,
        productId: port.productId
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
  console.log('🔍 Buscando ESP32...');
});

// Cierre limpio
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando conexión serial...');
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  process.exit();
});