const router      = require('express').Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/transactions?start=ts&end=ts
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.start) filter.ts = { $gte: Number(req.query.start) };
    if (req.query.end)   filter.ts = { ...filter.ts, $lte: Number(req.query.end) };

    const txs = await Transaction.find(filter).sort({ ts: -1 });
    res.json(txs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { type, amount, category, desc, date, ts } = req.body;
    if (!type || !amount || !category || !date || !ts)
      return res.status(400).json({ message: 'Field wajib: type, amount, category, date, ts' });

    const tx = await Transaction.create({
      userId: req.user._id,
      type, amount: Number(amount), category, desc, date, ts: Number(ts),
    });
    res.status(201).json(tx);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { type, amount, category, desc, date, ts } = req.body;
    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { type, amount: Number(amount), category, desc, date, ts: Number(ts) },
      { new: true, runValidators: true }
    );
    if (!tx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    res.json(tx);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!tx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    res.json({ message: 'Transaksi dihapus', id: req.params.id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/transactions/summary?period=monthly&year=2025&month=6
router.get('/summary', async (req, res) => {
  try {
    const { period = 'monthly', year, month } = req.query;
    const now = new Date();
    let start, end;

    if (period === 'monthly') {
      start = new Date(year || now.getFullYear(), (month ? month - 1 : now.getMonth()), 1);
      end   = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'weekly') {
      const d = now.getDay();
      start = new Date(now); start.setDate(now.getDate() - (d === 0 ? 6 : d - 1)); start.setHours(0,0,0,0);
      end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    } else {
      start = new Date(now); start.setHours(0,0,0,0);
      end   = new Date(now); end.setHours(23,59,59,999);
    }

    const txs = await Transaction.find({ userId: req.user._id, ts: { $gte: start.getTime(), $lte: end.getTime() } });
    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    res.json({ income, expense, net: income - expense, count: txs.length, period, start: start.toISOString(), end: end.toISOString() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
