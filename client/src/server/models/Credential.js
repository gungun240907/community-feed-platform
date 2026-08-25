const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const credentialSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Normalized login identifier (email/username lowercased, phone in E.164).
    identifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ['email', 'username', 'phone'],
      required: true,
    },
    // bcrypt hash of the password. The credentials live in this separate
    // collection so authentication can be checked independently of the user
    // profile document.
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

credentialSchema.index({ identifier: 1 }, { unique: true });

credentialSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.models.Credential || mongoose.model('Credential', credentialSchema);
