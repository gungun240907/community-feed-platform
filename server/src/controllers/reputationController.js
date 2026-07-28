const User = require('../models/User');
const ReputationLog = require('../models/ReputationLog');
const ReputationTransfer = require('../models/ReputationTransfer');
const { addReputation, getReputationPrivileges, getDailyTransferTotal, REPUTATION_VALUES } = require('../utils/reputationHelper');

async function getReputationHistory(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const userId = req.params.userId || req.user._id;

    const [logs, total] = await Promise.all([
      ReputationLog.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReputationLog.countDocuments({ user: userId }),
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + logs.length < total },
    });
  } catch (error) {
    next(error);
  }
}

async function getPrivileges(req, res, next) {
  try {
    const userId = req.params.userId || req.user._id;
    const user = await User.findById(userId).select('reputation');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const privileges = await getReputationPrivileges(user.reputation);
    res.json({ reputation: user.reputation, privileges });
  } catch (error) {
    next(error);
  }
}

async function transferReputation(req, res, next) {
  try {
    const { receiverUsername, amount, reason } = req.body;

    if (!receiverUsername || !amount || !reason) {
      return res.status(400).json({ error: 'Receiver, amount, and reason are required' });
    }

    const transferAmount = parseInt(amount);
    if (isNaN(transferAmount) || transferAmount < 1) {
      return res.status(400).json({ error: 'Transfer amount must be at least 1' });
    }
    if (transferAmount > 50) {
      return res.status(400).json({ error: 'Maximum transfer amount per transaction is 50 points' });
    }
    if (!reason || reason.trim().length > 200) {
      return res.status(400).json({ error: 'Reason is required and must be under 200 characters' });
    }

    const sender = await User.findById(req.user._id);
    if (sender.reputation <= 50) {
      return res.status(403).json({ error: 'You need more than 50 reputation points to transfer' });
    }

    const dailyTotal = await getDailyTransferTotal(sender._id);
    if (dailyTotal + transferAmount > 100) {
      return res.status(429).json({
        error: `Daily transfer limit reached. You have transferred ${dailyTotal}/100 points today.`,
        dailyUsed: dailyTotal,
        dailyLimit: 100,
      });
    }

    if (transferAmount > sender.reputation - 50) {
      return res.status(400).json({
        error: `Insufficient reputation. You must keep at least 50 points. You can transfer up to ${sender.reputation - 50} points.`,
        maxTransferable: Math.min(50, sender.reputation - 50),
      });
    }

    const receiver = await User.findOne({ username: receiverUsername.toLowerCase().trim() });
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    if (receiver._id.toString() === sender._id.toString()) {
      return res.status(400).json({ error: 'Cannot transfer reputation to yourself' });
    }

    const transfer = await ReputationTransfer.create({
      sender: sender._id,
      receiver: receiver._id,
      amount: transferAmount,
      reason: reason.trim(),
    });

    await Promise.all([
      User.findByIdAndUpdate(sender._id, { $inc: { reputation: -transferAmount } }),
      User.findByIdAndUpdate(receiver._id, { $inc: { reputation: transferAmount } }),
      ReputationLog.create({ user: sender._id, amount: -transferAmount, reason: 'transfer_sent', referenceType: 'transfer', referenceId: transfer._id }),
      ReputationLog.create({ user: receiver._id, amount: transferAmount, reason: 'transfer_received', referenceType: 'transfer', referenceId: transfer._id }),
    ]);

    res.json({
      message: `Successfully transferred ${transferAmount} reputation point${transferAmount > 1 ? 's' : ''} to @${receiver.username}`,
      transfer,
    });
  } catch (error) {
    next(error);
  }
}

async function getTransferHistory(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const userId = req.params.userId || req.user._id;

    const [transfers, total] = await Promise.all([
      ReputationTransfer.find({
        $or: [{ sender: userId }, { receiver: userId }],
      })
        .populate('sender', 'username displayName avatar')
        .populate('receiver', 'username displayName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReputationTransfer.countDocuments({
        $or: [{ sender: userId }, { receiver: userId }],
      }),
    ]);

    res.json({
      transfers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + transfers.length < total },
    });
  } catch (error) {
    next(error);
  }
}

async function checkCanTransfer(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('reputation');
    const canTransfer = user.reputation > 50;
    const dailyUsed = canTransfer ? await getDailyTransferTotal(user._id) : 0;

    res.json({
      canTransfer,
      reputation: user.reputation,
      dailyUsed,
      dailyLimit: 100,
      maxPerTransaction: 50,
      requiredReputation: 50,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getReputationHistory, getPrivileges, transferReputation, getTransferHistory, checkCanTransfer };
