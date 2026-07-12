/**
 * controllers/groupController.js
 * Handles Group database transactions (Creation, Listing, Requests, Approvals, Status updates, Invites, Exit, Deletion).
 */

const Group = require("../models/Group");
const User = require("../models/User");
const { sendJoinRequestEmail, sendInviteEmail } = require("../services/emailService");

const serializeGroup = (g) => ({
  id: g._id.toString(),
  name: g.name,
  creator_id: g.creator_id.toString(),
  members: g.members.map(m => m.toString()),
  pending_requests: g.pending_requests.map(r => r.toString()),
  pending_invitations: g.pending_invitations ? g.pending_invitations.map(i => i.toString()) : [],
  group_key: g.group_key,
  status: g.status || "public",
  member_preferences: (g.member_preferences || []).map(p => ({
    user_id: p.user_id.toString(),
    email_alerts: !!p.email_alerts,
    email_join_requests: !!p.email_join_requests,
    email_invites: !!p.email_invites
  }))
});

/**
 * GET /api/groups
 */
const getGroups = async (_req, res) => {
  try {
    const groups = await Group.find();
    const formatted = groups.map(g => serializeGroup(g));
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
      status: "public",
      member_preferences: [{
        user_id: creatorId,
        email_alerts: false,
        email_join_requests: false,
        email_invites: false
      }]
    });

    res.json({
      status: "ok",
      group: serializeGroup(newGroup)
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
      { 
        $pull: { 
          members: userId,
          member_preferences: { user_id: userId }
        } 
      },
      { new: true }
    );

    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }

    res.json({
      status: "ok",
      group: serializeGroup(grp)
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

      // Trigger email to leader asynchronously
      (async () => {
        try {
          const leader = await User.findById(grp.creator_id);
          const requester = await User.findById(userId);
          const leaderPref = grp.member_preferences?.find(p => p.user_id.toString() === grp.creator_id.toString());
          if (leader && requester && leaderPref?.email_join_requests && leader.email) {
            await sendJoinRequestEmail(leader.email, requester.username, grp.name);
          }
        } catch (e) {
          console.warn("[-] Failed to send join request email:", e.message);
        }
      })();
    }

    res.json({
      status: "ok",
      group: serializeGroup(grp)
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
      if (!grp.member_preferences) {
        grp.member_preferences = [];
      }
      if (!grp.member_preferences.some(p => p.user_id.toString() === userId.toString())) {
        grp.member_preferences.push({
          user_id: userId,
          email_alerts: false,
          email_join_requests: false,
          email_invites: false
        });
      }
    }

    await grp.save();

    res.json({
      status: "ok",
      group: serializeGroup(grp)
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

      // Trigger email to invitee asynchronously
      (async () => {
        try {
          if (targetUser.email) {
            const inviter = await User.findById(grp.creator_id);
            const inviterName = inviter ? inviter.username : "A cell leader";
            await sendInviteEmail(targetUser.email, inviterName, grp.name);
          }
        } catch (e) {
          console.warn("[-] Failed to send invite email:", e.message);
        }
      })();
    }

    res.json({
      status: "ok",
      group: serializeGroup(grp)
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
    if (!grp.member_preferences) {
      grp.member_preferences = [];
    }
    if (!grp.member_preferences.some(p => p.user_id.toString() === userId.toString())) {
      grp.member_preferences.push({
        user_id: userId,
        email_alerts: false,
        email_join_requests: false,
        email_invites: false
      });
    }

    await grp.save();

    res.json({
      status: "ok",
      group: serializeGroup(grp)
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
      group: serializeGroup(grp)
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
      group: serializeGroup(grp)
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
      group: serializeGroup(grp)
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * PATCH /api/groups/:id/member-settings
 */
const updateGroupMemberSettings = async (req, res) => {
  const groupId = req.params.id;
  const { userId, email_alerts, email_join_requests, email_invites } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId" });
  }

  try {
    const grp = await Group.findById(groupId);
    if (!grp) {
      return res.status(404).json({ status: "error", message: "Group not found" });
    }

    if (!grp.member_preferences) {
      grp.member_preferences = [];
    }

    let prefIndex = grp.member_preferences.findIndex(
      p => p.user_id.toString() === userId.toString()
    );

    if (prefIndex === -1) {
      grp.member_preferences.push({
        user_id: userId,
        email_alerts: typeof email_alerts === "boolean" ? email_alerts : false,
        email_join_requests: typeof email_join_requests === "boolean" ? email_join_requests : false,
        email_invites: typeof email_invites === "boolean" ? email_invites : false
      });
    } else {
      if (typeof email_alerts === "boolean") {
        grp.member_preferences[prefIndex].email_alerts = email_alerts;
      }
      if (typeof email_join_requests === "boolean") {
        grp.member_preferences[prefIndex].email_join_requests = email_join_requests;
      }
      if (typeof email_invites === "boolean") {
        grp.member_preferences[prefIndex].email_invites = email_invites;
      }
    }

    await grp.save();

    res.json({
      status: "ok",
      group: serializeGroup(grp)
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
  searchPublicGroup,
  updateGroupMemberSettings
};
