const Notifications = require("../models/notificationsModel");

exports.getNotifications = async (req, res) => {
  try {
    const notes = Notifications.getAll();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch notifications" });
  }
};

exports.addNotification = async (req, res) => {
  try {
    const newNote = Notifications.create(req.body);
    res.status(201).json(newNote);
  } catch (err) {
    res.status(500).json({ error: "Failed to insert notification" });
  }
};

exports.markRead = async (req, res) => {
  try {
    await Notifications.markRead(req.params.id);
    res.json({ message: "Notification marked read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    await Notifications.clear();
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear notifications" });
  }
};
