const { Schema, model } = require('mongoose');

const reminderSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  noteId:   { type: Schema.Types.ObjectId, ref: 'Note', required: true },
  label:    { type: String, required: true, trim: true, maxlength: 200 },
  datetime: { type: Number, required: true },   // Unix ms timestamp
  repeat:   { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
}, { timestamps: true });

reminderSchema.index({ userId: 1, datetime: 1 });

reminderSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id     = ret._id.toString();
    ret.noteId = ret.noteId.toString();
    delete ret._id; delete ret.__v; delete ret.userId;
    return ret;
  },
});

module.exports = model('Reminder', reminderSchema);
