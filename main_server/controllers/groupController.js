/**
 * controllers/groupController.js
 * Handles Group database transactions (Creation, Listing, Requests, Approvals, Status updates, Invites, Exit, Deletion).
 */

const Group = require("../models/Group");
const User = require("../models/User");

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
      pending_requests: g.pending_requests.map(r => r.toString()),
      pending_invitations: g.pending_invitations ? g.pending_invitations.map(i => i.toString()) : [],
      group_key: g.group_key,
      status: g.status || "public"
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
    const group_key = `grp-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newGroup = await Group.create({
      name,
      creator_id: creatorId,
      members: [creatorId],
      pending_requests: [],
      pending_invitations: [],
      group_key,
      status: "public"
    });

    res.json({
      status: "ok",
      group: {
        id: newGroup._id.toString(),
        name: newGroup.name,
        creator_id: newGroup.creator_id.toString(),
        members: newGroup.members.map(m => m.toString()),
        pending_requests: [],
        pending_invitations: [],
        group_key: newGroup.group_key,
        status: newGroup.status
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
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
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
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
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

    grp.pending_requests = grp.pending_requests.filter(uid => uid.toString() !== userId);

    if (approve) {
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
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups/:id/invite
 */
const inviteUser = async (req, res) => {
  const groupId = req.params.id;
  const { userKey } = req.body;

  if (!userKey) {
    return res.status(400).json({ status: "error", message: "Missing userKey" });
  }

  try {
    const targetUser = await User.findOne({ user_key: userKey });
    if (!targetUser) {
      return res.status(404).json({ status: "error", message: "User not found with the provided key" });
    }

    const grp = await Group.findById(groupId);
    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }

    if (grp.members.includes(targetUser._id)) {
      return res.status(400).json({ status: "error", message: "User is already a member of this group" });
    }

    if (!grp.pending_invitations.includes(targetUser._id)) {
      grp.pending_invitations.push(targetUser._id);
      await grp.save();
    }

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups/:id/accept
 */
const acceptInvite = async (req, res) => {
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

    grp.pending_invitations = grp.pending_invitations.filter(uid => uid.toString() !== userId);

    if (!grp.members.includes(userId)) {
      grp.members.push(userId);
    }

    await grp.save();

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/groups/:id/decline
 */
const declineInvite = async (req, res) => {
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

    grp.pending_invitations = grp.pending_invitations.filter(uid => uid.toString() !== userId);
    await grp.save();

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * PATCH /api/groups/:id/status
 */
const updateGroupStatus = async (req, res) => {
  const groupId = req.params.id;
  const { status } = req.body;

  if (!status || !["public", "private"].includes(status)) {
    return res.status(400).json({ status: "error", message: "Invalid status value. Must be 'public' or 'private'" });
  }

  try {
    const grp = await Group.findByIdAndUpdate(
      groupId,
      { status },
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
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /api/groups/search/:group_key
 */
const searchPublicGroup = async (req, res) => {
  const { group_key } = req.params;

  try {
    const grp = await Group.findOne({ group_key });
    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found with the provided key" });
    }

    if (grp.status === "private") {
      return res.status(403).json({ status: "error", message: "This security group is private and cannot be searched" });
    }

    res.json({
      status: "ok",
      group: {
        id: grp._id.toString(),
        name: grp.name,
        creator_id: grp.creator_id.toString(),
        members: grp.members.map(m => m.toString()),
        pending_requests: grp.pending_requests.map(r => r.toString()),
        pending_invitations: grp.pending_invitations ? grp.pending_invitations.map(i => i.toString()) : [],
        group_key: grp.group_key,
        status: grp.status || "public"
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
  approveJoinRequest,
  inviteUser,
  acceptInvite,
  declineInvite,
  updateGroupStatus,
  searchPublicGroup
};
