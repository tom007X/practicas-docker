const express = require('express');
const pool = require('../db');
const { convertirArsAUsd } = require('../exchangeRate');

const router = express.Router();

// GET /pagos -> listar todos
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pagos');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pagos' });
  }
});

// GET /pagos/:id -> obtener uno
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pagos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar el pago' });
  }
});

// POST /pagos -> crear (alta). Convierte monto_ars a USD llamando a una API externa.
router.post('/', async (req, res) => {
  const { monto_ars, medio_pago } = req.body;
  if (monto_ars === undefined || !medio_pago) {
    return res.status(400).json({ error: 'Faltan campos: monto_ars, medio_pago' });
  }
  try {
    const montoUsd = await convertirArsAUsd(monto_ars);
    const [result] = await pool.query(
      'INSERT INTO pagos (monto_ars, monto_usd, medio_pago) VALUES (?, ?, ?)',
      [monto_ars, montoUsd, medio_pago]
    );
    res.status(201).json({ id: result.insertId, monto_ars, monto_usd: montoUsd, medio_pago });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el pago' });
  }
});

// PUT /pagos/:id -> modificar
router.put('/:id', async (req, res) => {
  const { monto_ars, medio_pago } = req.body;
  try {
    const montoUsd = await convertirArsAUsd(monto_ars);
    const [result] = await pool.query(
      'UPDATE pagos SET monto_ars = ?, monto_usd = ?, medio_pago = ? WHERE id = ?',
      [monto_ars, montoUsd, medio_pago, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ id: Number(req.params.id), monto_ars, monto_usd: montoUsd, medio_pago });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el pago' });
  }
});

// DELETE /pagos/:id -> baja
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM pagos WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al borrar el pago' });
  }
});

module.exports = router;
