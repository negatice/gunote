const router   = require('express').Router();
const Reminder = require('../models/Reminder');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/reminders
router.get('/', async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id }).sort({ datetime: 1 });
    res.json(reminders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/reminders
router.post('/', async (req, res) => {
  try {
    const { noteId, label, datetime, repeat } = req.body;
    if (!noteId || !label || !datetime)
      return res.status(400).json({ message: 'noteId, label, dan datetime wajib diisi' });

    const reminder = await Reminder.create({
      userId: req.user._id,
      noteId, label, datetime, repeat,
    });
    res.status(201).json(reminder);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/reminders/:id  – update (misal: advance repeat atau snooze)
router.put('/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ message: 'Reminder tidak ditemukan' });
    res.json(reminder);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!reminder) return res.status(404).json({ message: 'Reminder tidak ditemukan' });
    res.json({ message: 'Reminder dihapus', id: req.params.id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
