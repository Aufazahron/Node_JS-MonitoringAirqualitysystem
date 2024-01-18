// server.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const potCharts = {}; // Menyimpan instance Chart.js untuk setiap potensiometer

app.post('/updateData', (req, res) => {
  const potValues = parsePotValues(req.body);

  // Kirim nilai potensiometer ke klien melalui soket
  io.emit('potensiometer', potValues);

  // Buat chart baru jika belum ada
  createOrUpdateChart(potValues);

  res.send('OK');
});

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

function parsePotValues(body) {
    const potValues = {};
    
    // Menggunakan filter untuk mendapatkan semua kunci yang memiliki awalan 'value'
    const valueKeys = Object.keys(body).filter((key) => key.startsWith('value'));
  
    // Jika tidak ada kunci dengan awalan 'value', coba mencoba dengan nama kunci alternatif
    if (valueKeys.length === 0) {
      // Alternatif nama kunci yang diharapkan dari ESP8266
      const alternativeKeys = ['co', 'no2', 'nh3', 'airquality', 'humd', 'temp'];
  
      alternativeKeys.forEach((altKey, index) => {
        const altValue = parseFloat(body[altKey]);
        if (!isNaN(altValue)) {
          // Jika nilai adalah angka, tambahkan ke potValues
          potValues[`value${index + 1}`] = altValue;
        }
      });
    } else {
      // Memproses setiap kunci dan nilainya
      valueKeys.forEach((key, index) => {
        const valueName = key.toLowerCase(); // Mengubah nama kunci menjadi lowercase
        potValues[`value${index + 1}`] = parseFloat(body[key]);
      });
    }
  
    potValues.time = new Date().toLocaleTimeString();
    return potValues;
  }

function createOrUpdateChart(potValues) {
  const numValues = Object.keys(potValues).filter((key) => key.startsWith('value')).length;

  // Jika belum ada chart untuk jumlah nilai ini, buat chart baru
  if (!potCharts[numValues]) {
    console.log(`Creating chart for ${numValues} values`);

    // Membuat chart hanya jika di lingkungan server (Node.js)
    if (typeof document === 'undefined') {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.id = `potChart${numValues}`;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const newPotChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({ length: 25 }, (_, i) => i),
        datasets: [
          {
            label: `Potensiometer ${numValues}`,
            borderColor: getRandomColor(),
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            data: Array.from({ length: 25 }, () => null),
          }
        ]
      },
      options: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            max: 24,
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                var label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(2);
                }
                return label;
              },
              title: function(context) {
                return 'Waktu: ' + potValues.time;
              }
            }
          }
        }
      }
    });

    potCharts[numValues] = newPotChart;
  }

  // Memindahkan semua nilai ke kiri
  const potValuesArray = Array.from({ length: 25 }, () => null);
  Object.keys(potValues).forEach((key) => {
    if (key.startsWith('value')) {
      const index = key.replace('value', '');
      potValuesArray.shift();
      potValuesArray.push(potValues[`value${index}`]);
    }
  });

  // Mengupdate data pada chart
  potCharts[numValues].data.datasets[0].data = potValuesArray;

  // Mengupdate chart
  potCharts[numValues].update();
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
