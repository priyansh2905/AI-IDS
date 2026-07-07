/**
 * controllers/groupController.js
 * Handles Group database transactions (Creation, Listing, Requests, Approvals, Exit, Deletion).
 */

const Group = require("../models/Group");

/**
 * GET /api/groups
 */
const getGroups = async (_req, res) => {
  try {
    const groups = await Group.find().lean();
    const formatted = groups.map(g => ({
      id: g._id.toString(),
      name: g.name,
      creator_id: g.creator_id.toString(),
      members: g.members.map(m => m.toString()),
      pending_requests: g.pending_requests.map(r => r.toString())
    }));
    res.json({ status: "ok", data: formatted });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups
 */
const createGroup = async (req, res) => {
  const { name, creatorId } = req.body;

  if (!name || !creatorId) {
    return res.status(400).json({ status: "error", message: "Missing name or creatorId" });
  }

  try {
    const newGroup = await Group.create({
      name,
      creator_id: creatorId,
      members: [creatorId],
      pending_requests: []
    });

    res.json({
      status: "ok",
      group: {
        id: newGroup._id.toString(),
        name: newGroup.name,
        creator_id: newGroup.creator_id.toString(),
        members: newGroup.members.map(m => m.toString()),
        pending_requests: []
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * DELETE /api/groups/:id
 */
const deleteGroup = async (req, res) => {
  const groupId = req.params.id;

  try {
    const deleted = await Group.findByIdAndDelete(groupId);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }
    res.json({ status: "ok", message: "Group dissolved successfully" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups/:id/exit
 */
const exitGroup = async (req, res) => {
  const groupId = req.params.id;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId" });
  }

  try {
    const grp = await Group.findByIdAndUpdate(
      groupId,
      { $pull: { members: userId } },
      { new: true }
    );

    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString())
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups/:id/request
 */
const joinRequest = async (req, res) => {
  const groupId = req.params.id;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId" });
  }

  try {
    const grp = await Group.findById(groupId);
    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }

    // Add user to pending_requests if not already members or pending
    if (!grp.members.includes(userId) && !grp.pending_requests.includes(userId)) {
      grp.pending_requests.push(userId);
      await grp.save();
    }

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString())
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups/:id/approve
 */
const approveJoinRequest = async (req, res) => {
  const groupId = req.params.id;
  const { userId, approve } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId" });
  }

  try {
    const grp = await Group.findById(groupId);
    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }

    // Pull from pending
    grp.pending_requests = grp.pending_requests.filter(uid => uid.toString() !== userId);

    if (approve) {
      // Add to members if not already members
      if (!grp.members.includes(userId)) {
        grp.members.push(userId);
      }
    }

    await grp.save();

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString())
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = {
  getGroups,
  createGroup,
  deleteGroup,
  exitGroup,
  joinRequest,
  approveJoinRequest
};
