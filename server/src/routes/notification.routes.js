import express from 'express';
import { Notification } from '../models/Notification.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read - mark single as read
router.patch('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );

    res.json({
      success: true,
      data: notif
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all - mark all as read
router.patch('/read-all', authenticateToken, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );

    res.json({
      success: true,
      data: { message: 'All notifications marked as read' }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
