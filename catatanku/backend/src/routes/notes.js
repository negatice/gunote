const router   = require('express').Router();
const Note     = require('../models/Note');
const Reminder = require('../models/Reminder');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/notes  – ambil semua catatan milik user
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/notes  – buat catatan baru
router.post('/', async (req, res) => {
  try {
    const { emoji, title, desc, type, tags, pinned, messages } = req.body;
    if (!title) return res.status(400).json({ message: 'Judul wajib diisi' });

    const note = await Note.create({
      userId: req.user._id,
      emoji: emoji || '📝',
      title, desc, type, tags,
      pinned: pinned || false,
      messages: messages || [],
    });
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/notes/:id  – update catatan (termasuk messages)
router.put('/:id', async (req, res) => {
  try {
    const { emoji, title, desc, type, tags, pinned, messages, updatedAt } = req.body;
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { emoji, title, desc, type, tags, pinned, messages,
        updatedAt: updatedAt ? new Date(updatedAt) : undefined },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ message: 'Catatan tidak ditemukan' });
    res.json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/notes/:id  – hapus catatan + semua remindernya
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!note) return res.status(404).json({ message: 'Catatan tidak ditemukan' });
    await Reminder.deleteMany({ noteId: req.params.id, userId: req.user._id });
    res.json({ message: 'Catatan dihapus', id: req.params.id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
