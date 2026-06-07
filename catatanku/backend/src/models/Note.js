const { Schema, model } = require('mongoose');

const todoItemSchema = new Schema({
  id:   { type: String, required: true },
  text: { type: String, required: true, maxlength: 500 },
  done: { type: Boolean, default: false },
}, { _id: false });

const messageSchema = new Schema({
  id:    { type: String, required: true },
  type:  { type: String, enum: ['note', 'todo', 'reminder'], required: true },
  text:  { type: String, maxlength: 5000 },
  items: [todoItemSchema],
  ts:    { type: Number, default: () => Date.now() },
}, { _id: false });

const noteSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  emoji:    { type: String, default: '📝' },
  title:    { type: String, required: true, trim: true, maxlength: 100 },
  desc:     { type: String, maxlength: 300, default: '' },
  type:     { type: String, enum: ['note', 'todo'], default: 'note' },
  tags:     [{ type: String, enum: ['work', 'personal', 'idea', 'urgent'] }],
  pinned:   { type: Boolean, default: false },
  messages: [messageSchema],
}, { timestamps: true });

noteSchema.index({ userId: 1, updatedAt: -1 });

noteSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id        = ret._id.toString();
    ret.createdAt = ret.createdAt?.getTime();
    ret.updatedAt = ret.updatedAt?.getTime();
    delete ret._id; delete ret.__v; delete ret.userId;
    return ret;
  },
});

module.exports = model('Note', noteSchema);
