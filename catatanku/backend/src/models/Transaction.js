const { Schema, model } = require('mongoose');

const transactionSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:     { type: String, enum: ['income', 'expense'], required: true },
  amount:   { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  desc:     { type: String, maxlength: 200, default: '' },
  date:     { type: String, required: true },   // YYYY-MM-DD
  ts:       { type: Number, required: true },   // Unix ms timestamp
}, { timestamps: true });

transactionSchema.index({ userId: 1, ts: -1 });
transactionSchema.index({ userId: 1, date: 1 });

transactionSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id; delete ret.__v; delete ret.userId;
    return ret;
  },
});

module.exports = model('Transaction', transactionSchema);
