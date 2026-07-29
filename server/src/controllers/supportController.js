const SupportTicket = require('../models/SupportTicket');
const { sendSupportEmail } = require('../utils/emailService');

async function submitSupportTicket(req, res, next) {
  try {
    const { subject, category, message } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!category || !['bug', 'feature', 'account', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    const isPriority = req.user.subscriptionPlan === 'silver' || req.user.subscriptionPlan === 'gold';

    await SupportTicket.create({
      user: req.user._id,
      subject: subject.trim(),
      category,
      message: message.trim(),
    });

    await sendSupportEmail({
      user: req.user,
      subject: subject.trim(),
      category,
      message: message.trim(),
      isPriority,
    });

    res.json({
      message: 'Support ticket submitted successfully. We will get back to you soon.',
      priority: isPriority,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyTickets(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      SupportTicket.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + tickets.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { submitSupportTicket, getMyTickets };
