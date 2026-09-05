require('dotenv').config();
const express = require('express');
const pagosRouter = require('./routes/pagos');

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', servicio: 'api-pagos' });
});

app.use('/pagos', pagosRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API de pagos escuchando en el puerto ${PORT}`);
});
