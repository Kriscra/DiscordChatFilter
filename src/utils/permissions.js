const config = require("../config");

function getOwnerIds() {
  const owners = config.Bot?.OwnerIds;
  if (!Array.isArray(owners)) {
    return [];
  }

  return owners
    .map((id) => (id == null ? null : String(id).trim()))
    .filter((id) => id);
}

function isBotOwner(userId) {
  if (!userId) {
    return false;
  }

  const owners = getOwnerIds();

  if (!owners.length) {
    return false;
  }

  return owners.includes(String(userId));
}

module.exports = {
  getOwnerIds,
  isBotOwner,
};
